import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { decodeWorkspaceSnapshot } from '../../src/lib/workspace-schema.ts';
import { decodeCommandResult } from '../../src/lib/workspace-commands.ts';
const db = new PGlite();
const q = (sql, args = []) => db.query(sql, args);
let checks = 0;
const actor = randomUUID(),
  outsider = randomUUID(),
  staff = randomUUID();
let org;
async function root() {
  await db.exec('reset role');
}
async function as(id) {
  await root();
  await q("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec('set role authenticated');
}
async function command(operation, payload, key = randomUUID(), organization = org) {
  const result = (
    await q('select public.workspace_command($1,$2,$3::jsonb,$4) data', [
      organization,
      operation,
      JSON.stringify(payload),
      key,
    ])
  ).rows[0].data;
  assert.ok(decodeCommandResult(operation, result));
  return result;
}
async function state() {
  const result = (await q('select public.get_workspace_state($1) data', [org])).rows[0].data;
  assert.ok(decodeWorkspaceSnapshot(result));
  return result;
}
async function check(name, run) {
  await run();
  checks++;
  console.log(`PASS ${name}`);
}
const input = {
  title: 'Working meeting',
  number: '1/2026',
  date: '2026-11-01',
  time: '09:00',
  location: 'Room A',
  committee: 'Committee',
  status: 'scheduled',
  agenda: [],
};
try {
  await db.exec(`create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,confirmation_sent_at timestamptz,banned_until timestamptz,deleted_at timestamptz,raw_user_meta_data jsonb default '{}'::jsonb);
 create table auth.identities(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id),provider text,identity_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
  const dir = new URL('../migrations/', import.meta.url);
  if (process.env.MEETING_TEST_INSTALL_BUNDLE === '1') {
    await db.exec(await readFile(new URL('../install.sql', import.meta.url), 'utf8'));
  } else {
    for (const file of (await readdir(dir)).filter((file) => file.endsWith('.sql')).sort())
      await db.exec(await readFile(new URL(file, dir), 'utf8'));
  }
  for (const [id, email] of [
    [actor, 'admin@example.test'],
    [outsider, 'other@example.test'],
    [staff, 'staff@example.test'],
  ]) {
    await q('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())', [id, email]);
    await q(
      "insert into auth.identities(user_id,provider,identity_data) values($1,'email',$2::jsonb)",
      [id, JSON.stringify({ email, email_verified: true })],
    );
  }
  org = (
    await q(
      "select private.bootstrap_workspace($1,'Meeting test','Admin','Office',array['secretary']) id",
      [actor],
    )
  ).rows[0].id;
  await q('select private.bootstrap_admin($1,$2)', ['admin@example.test', org]);
  const other = (
    await q(
      "select private.bootstrap_workspace($1,'Other org','Other','Other office',array['secretary']) id",
      [outsider],
    )
  ).rows[0].id;
  await q('select private.bootstrap_admin($1,$2)', ['other@example.test', other]);
  await q("select private.provision_member($1,$2,'Staff','Office',array['owner'])", [org, staff]);
  await as(actor);
  const meeting = (await command('add_meeting', input)).id;
  const originalCount = (await state()).state.resolutions.length;
  await check(
    'old commands and snapshots remain compatible; new meeting capability is explicit',
    async () => {
      const s = await state();
      assert.equal(s.features.meetingManagement, true);
      assert.equal(s.state.meetings.find((m) => m.id === meeting).rowVersion, 1);
    },
  );
  const agendaPayload = { id: meeting, expectedVersion: 1, number: '1', title: 'Follow up' };
  const key = randomUUID();
  await check('add agenda is idempotent and increments meeting version once', async () => {
    const first = await command('add_agenda', agendaPayload, key);
    assert.deepEqual(await command('add_agenda', agendaPayload, key), first);
    assert.equal(first.version, 2);
    assert.equal((await state()).state.meetings[0].agenda.length, 1);
  });
  await check(
    'stale edits and duplicate agenda numbers cannot overwrite current work',
    async () => {
      await assert.rejects(() => command('add_agenda', agendaPayload), /STALE_VERSION/);
      await assert.rejects(
        () => command('add_agenda', { ...agendaPayload, expectedVersion: 2 }),
        /unique|duplicate/,
      );
    },
  );
  let resolution, originAgenda;
  await check('new resolution retains its original meeting and agenda', async () => {
    const s = await state();
    originAgenda = s.state.meetings[0].agenda[0].id;
    resolution = (
      await command('add_resolution', {
        title: 'Resolution',
        content: 'Original wording',
        meetingId: meeting,
        agenda: '1',
        type: 'action',
        unit: 'Office',
        coordinatorId: s.state.currentUserId,
        closureCriteria: ['Verified result'],
      })
    ).id;
    assert.equal((await state()).state.resolutions.length, originalCount + 1);
  });
  const later = (
    await command('add_meeting', {
      ...input,
      number: '2/2026',
      agenda: [{ number: '3.1', title: 'Carry forward' }],
    })
  ).id;
  const laterAgenda = (await state()).state.meetings.find((m) => m.id === later).agenda[0].id;
  const link = {
    id: later,
    expectedVersion: 1,
    agendaId: laterAgenda,
    resolutionId: resolution,
    note: 'Discuss progress next month',
  };
  await check('link existing resolution preserves counts, source and recorded status', async () => {
    await command('link_resolution', link);
    const s = await state();
    assert.equal(s.state.resolutions.length, originalCount + 1);
    assert.equal(s.state.resolutions[0].meetingId, meeting);
    const a = s.state.meetings.find((m) => m.id === later).agenda[0];
    assert.deepEqual(a.resolutionIds, [resolution]);
    assert.equal(a.followups[0].status, 'open');
    assert.equal(a.followups[0].note, link.note);
  });
  await check(
    'follow-up records do not rewrite earlier status as the resolution advances',
    async () => {
      await root();
      await q("update public.resolution_cycles set status='pending_close' where id=$1", [
        resolution,
      ]);
      await as(actor);
      assert.equal(
        (await state()).state.meetings.find((m) => m.id === later).agenda[0].followups[0].status,
        'open',
      );
    },
  );
  await check('duplicate follow-ups and agenda from another meeting are denied', async () => {
    await assert.rejects(
      () => command('link_resolution', { ...link, expectedVersion: 2 }),
      /unique|duplicate/,
    );
    await assert.rejects(
      () => command('link_resolution', { ...link, expectedVersion: 2, agendaId: originAgenda }),
      /FORBIDDEN/,
    );
  });
  const edit = {
    id: later,
    expectedVersion: 2,
    title: 'Updated meeting',
    date: '2026-11-02',
    time: '13:30',
    location: 'Room B',
    status: 'completed',
    reason: 'Schedule confirmed',
  };
  await check(
    'meeting edit saves all metadata, keeps links and records audit without authorizing work',
    async () => {
      await command('update_meeting', edit);
      const s = await state();
      const m = s.state.meetings.find((m) => m.id === later);
      for (const field of ['title', 'date', 'time', 'location', 'status'])
        assert.equal(m[field], edit[field]);
      assert.equal(m.rowVersion, 3);
      assert.equal(m.agenda[0].resolutionIds[0], resolution);
      assert.equal(s.state.resolutions[0].executionAuthorized, false);
      assert.ok(s.state.audit.some((a) => a.detail.includes(edit.reason)));
    },
  );
  await check('server rejects missing reason, invalid time and non-string metadata', async () => {
    for (const patch of [{ reason: '' }, { time: '25:61' }, { title: 42 }])
      await assert.rejects(
        () => command('update_meeting', { ...edit, expectedVersion: 3, ...patch }),
        /VALIDATION_FAILED/,
      );
  });
  await check(
    'staff cannot edit meetings and their projection gains no follow-up notes',
    async () => {
      await as(staff);
      await assert.rejects(
        () => command('update_meeting', { ...edit, expectedVersion: 3 }),
        /FORBIDDEN|PAGE_ACCESS_DENIED/,
      );
      assert.ok(!JSON.stringify(await state()).includes(link.note));
    },
  );
  await check('cross-organization and direct private-table access are denied', async () => {
    await as(outsider);
    await assert.rejects(
      () => command('update_meeting', { ...edit, expectedVersion: 3 }),
      /FORBIDDEN/,
    );
    await assert.rejects(
      () => command('update_meeting', { ...edit, expectedVersion: 3 }, randomUUID(), other),
      /NOT_FOUND/,
    );
    await assert.rejects(
      () => q('select * from private.meeting_resolution_followups'),
      /permission denied/,
    );
  });
  await check(
    'upgrade can be rerun without changing links or breaking prior RPC wrappers',
    async () => {
      await root();
      await db.exec(await readFile(new URL('202610250007_meeting_management.sql', dir), 'utf8'));
      await as(actor);
      assert.equal(
        (await state()).state.meetings.find((m) => m.id === later).agenda[0].followups.length,
        1,
      );
      await command('add_meeting', { ...input, number: '3/2026' });
    },
  );
  await check('anonymous callers cannot execute workspace RPC', async () => {
    await root();
    await db.exec('set role anon');
    await assert.rejects(() => command('update_meeting', edit), /permission denied/);
  });
  console.log(`${checks} meeting-management checks passed in isolated PostgreSQL.`);
} finally {
  await db.close();
}
