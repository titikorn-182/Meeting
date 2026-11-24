import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
const q = (sql, args = []) => db.query(sql, args);
const admin = randomUUID();
let org;
let checks = 0;
async function root() {
  await db.exec('reset role');
}
async function as(id) {
  await root();
  await q("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec('set role authenticated');
}
async function claim(id) {
  await as(id);
  return (await q('select public.claim_workspace_invitations() data')).rows[0].data;
}
async function account(email, invite = true, role = 'staff') {
  await root();
  const id = randomUUID();
  await q('insert into auth.users(id,email) values($1,$2)', [id, email]);
  if (invite) {
    await as(admin);
    await q('select public.workspace_command($1,$2,$3::jsonb,$4)', [
      org,
      'add_personnel',
      JSON.stringify({ firstName: 'Test', lastName: 'Person', email, unit: 'Office', role }),
      randomUUID(),
    ]);
  }
  return id;
}
async function profile(id) {
  await root();
  return (await q('select profile_id id from public.auth_identities where auth_user_id=$1', [id]))
    .rows[0]?.id;
}
async function check(name, run) {
  await run();
  checks++;
  console.log('PASS ' + name);
}
try {
  await db.exec(`create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;
 create schema auth;create table auth.users(id uuid primary key,email text,email_change text,email_confirmed_at timestamptz,confirmation_sent_at timestamptz,banned_until timestamptz,deleted_at timestamptz,is_anonymous boolean default false,raw_user_meta_data jsonb default '{}'::jsonb);
 create table auth.identities(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id),provider text,identity_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
  const dir = new URL('../migrations/', import.meta.url);
  for (const file of (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort())
    await db.exec(await readFile(new URL(file, dir), 'utf8'));
  await q('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())', [
    admin,
    'admin@example.test',
  ]);
  org = (
    await q(
      "select private.bootstrap_workspace($1,'Email access test','Admin','Office',array['secretary']) id",
      [admin],
    )
  ).rows[0].id;
  await q('select private.bootstrap_admin($1,$2)', ['admin@example.test', org]);
  await check(
    'unconfirmed invited account receives the administrator-configured role without changing Auth proof',
    async () => {
      const id = await account('future@example.test', true, 'admin');
      await root();
      await q(
        "insert into auth.identities(user_id,provider,identity_data) values($1,'email',$2::jsonb)",
        [id, JSON.stringify({ email: 'future@example.test', email_verified: false })],
      );
      const result = await claim(id);
      assert.equal(result.claimed, 1);
      assert.equal(result.emailVerificationRequired, false);
      assert.equal(result.emailVerified, undefined);
      const s = (await q('select public.get_workspace_state($1) data', [org])).rows[0].data;
      assert.equal(s.access.role, 'admin');
      assert.equal((await claim(id)).claimed, 0);
      await root();
      assert.equal(
        (await q('select email_confirmed_at from auth.users where id=$1', [id])).rows[0]
          .email_confirmed_at,
        null,
      );
      assert.equal(
        (
          await q(
            "select identity_data->'email_verified' verified from auth.identities where user_id=$1",
            [id],
          )
        ).rows[0].verified,
        false,
      );
      const p = await profile(id);
      assert.equal(
        (
          await q(
            "select count(*)::int n from private.audit_events where actor_id=$1 and operation='claim_personnel'",
            [p],
          )
        ).rows[0].n,
        1,
      );
    },
  );
  await check('autoconfirmed account without identity verification can claim', async () => {
    const id = await account('auto@example.test');
    await root();
    await q('update auth.users set email_confirmed_at=now() where id=$1', [id]);
    assert.equal((await claim(id)).claimed, 1);
  });
  await check(
    'no reservation means no membership, regardless of forged metadata or requested email change',
    async () => {
      const id = await account('outsider@example.test', false);
      await root();
      await q('update auth.users set email_change=$2,raw_user_meta_data=$3::jsonb where id=$1', [
        id,
        'future@example.test',
        JSON.stringify({ email: 'future@example.test', role: 'admin', email_verified: true }),
      ]);
      assert.equal((await claim(id)).claimed, 0);
      assert.equal(await profile(id), undefined);
    },
  );
  await check('duplicate normalized Auth email stays ambiguous', async () => {
    const id = await account('duplicate@example.test');
    await account(' DUPLICATE@example.test ', false);
    assert.equal((await claim(id)).claimed, 0);
  });
  for (const [name, patch] of [
    ['banned', "banned_until=now()+interval '1 day'"],
    ['deleted', 'deleted_at=now()'],
    ['anonymous', 'is_anonymous=true'],
    ['empty', "email=''"],
    ['missing', 'email=null'],
  ]) {
    await check(name + ' account cannot claim', async () => {
      const id = await account(name + '@example.test');
      await root();
      await q('update auth.users set ' + patch + ' where id=$1', [id]);
      assert.equal((await claim(id)).claimed, 0);
      assert.equal(await profile(id), undefined);
    });
  }
  for (const entity of ['organization', 'unit'])
    await check('inactive ' + entity + ' cannot claim', async () => {
      const id = await account(entity + '@example.test');
      await root();
      const table = entity === 'organization' ? 'organizations' : 'organization_units';
      const where = entity === 'organization' ? 'id' : 'organization_id';
      await q('update public.' + table + ' set is_active=false where ' + where + '=$1', [org]);
      assert.equal((await claim(id)).claimed, 0);
      await root();
      await q('update public.' + table + ' set is_active=true where ' + where + '=$1', [org]);
    });
  for (const kind of ['suspended', 'revoked', 'expired', 'profile', 'identity'])
    await check(kind + ' membership is never reactivated', async () => {
      const id = await account(kind + '@example.test');
      assert.equal((await claim(id)).claimed, 1);
      const p = await profile(id);
      if (kind === 'profile')
        await q('update public.profiles set disabled_at=now() where id=$1', [p]);
      else if (kind === 'identity')
        await q('update public.auth_identities set disabled_at=now() where profile_id=$1', [p]);
      else
        await q(
          'update public.organization_memberships set ' +
            (kind === 'suspended'
              ? "status='suspended'"
              : kind === 'revoked'
                ? 'revoked_at=now()'
                : "valid_from=now()-interval '2 days',valid_to=now()-interval '1 day'") +
            ' where profile_id=$1',
          [p],
        );
      await q(
        'update private.personnel_invitations set claimed_at=null,claimed_by=null where email=$1',
        [kind + '@example.test'],
      );
      assert.equal((await claim(id)).claimed, 0);
      await root();
      assert.equal(
        (
          await q('select claimed_at from private.personnel_invitations where email=$1', [
            kind + '@example.test',
          ])
        ).rows[0].claimed_at,
        null,
      );
    });
  await check('canonical Auth email is case-insensitive and role stays as reserved', async () => {
    const id = await account('case@example.test', true, 'executive');
    await root();
    await q('update auth.users set email=$2 where id=$1', [id, ' CASE@example.test ']);
    assert.equal((await claim(id)).claimed, 1);
    const p = await profile(id);
    assert.equal(
      (await q('select role from private.member_access_roles where profile_id=$1', [p])).rows[0]
        .role,
      'executive',
    );
  });
  await check('migration rerun preserves memberships and reservations', async () => {
    await root();
    const before = (await q('select count(*)::int n from public.organization_memberships')).rows[0]
      .n;
    await db.exec(
      await readFile(
        new URL('../migrations/202611240008_personnel_email_access.sql', import.meta.url),
        'utf8',
      ),
    );
    assert.equal(
      (await q('select count(*)::int n from public.organization_memberships')).rows[0].n,
      before,
    );
  });
  await check('unauthenticated and anonymous database roles cannot claim', async () => {
    await as('');
    await assert.rejects(() => q('select public.claim_workspace_invitations()'), /UNAUTHENTICATED/);
    await root();
    await db.exec('set role anon');
    await assert.rejects(
      () => q('select public.claim_workspace_invitations()'),
      /permission denied/,
    );
  });
  console.log(checks + ' email-access checks passed. No hosted account was modified.');
} finally {
  await db.close();
}
