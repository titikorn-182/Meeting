import { decodeCommandResult } from '../../src/lib/workspace-commands.ts';
import { decodeWorkspaceSnapshot } from '../../src/lib/workspace-schema.ts';
/** Real migrations in PostgreSQL WASM. Auth verification is represented by Auth-owned
 * rows, not simulated UI metadata. Hosted Auth/SMTP and concurrent locks need a smoke test. */
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';

const db = new PGlite();
const query = (sql, args = []) => db.query(sql, args);
const actors = {},
  people = {},
  invitations = {};
let org,
  otherOrg,
  checks = 0;
const seed = {
  firstName: 'สมใจ',
  lastName: 'ใจดี',
  email: 'future@example.test',
  unit: 'Office',
  role: 'staff',
};
async function root() {
  await db.exec('reset role');
  await query("select set_config('request.jwt.claim.sub','',false)");
}
async function as(name) {
  await root();
  await query("select set_config('request.jwt.claim.sub',$1,false)", [actors[name]]);
  await db.exec('set role authenticated');
}
async function state(organization = org) {
  const data = (await query('select public.get_workspace_state($1) data', [organization])).rows[0]
    .data;
  assert.ok(decodeWorkspaceSnapshot(data), 'SQL response must satisfy the application contract');
  return data;
}
async function command(operation, payload, key = randomUUID(), organization = org) {
  const data = (
    await query('select public.workspace_command($1,$2,$3::jsonb,$4) data', [
      organization,
      operation,
      JSON.stringify(payload),
      key,
    ])
  ).rows[0].data;
  assert.ok(
    decodeCommandResult(operation, data),
    'SQL command result must satisfy the application contract',
  );
  return data;
}
async function claim() {
  return (await query('select public.claim_workspace_invitations() data')).rows[0].data;
}
async function denied(run, message) {
  await assert.rejects(run, (error) => error.message.includes(message), message);
}
async function check(name, run) {
  await run();
  checks++;
  console.log(`PASS ${name}`);
}
async function auth(
  name,
  { email = `${name}@example.test`, confirmed = true, identityVerified = true } = {},
) {
  await root();
  actors[name] = randomUUID();
  await query(
    'insert into auth.users(id,email,email_confirmed_at) values($1,$2,case when $3 then now() end)',
    [actors[name], email, confirmed],
  );
  await query(
    "insert into auth.identities(user_id,provider,identity_data) values($1,'email',$2::jsonb)",
    [actors[name], JSON.stringify({ email, email_verified: identityVerified })],
  );
}
async function invite(name, role = 'staff') {
  await as('admin');
  invitations[name] = (
    await command('add_personnel', { ...seed, email: `${name}@example.test`, role })
  ).id;
  return invitations[name];
}
async function provision(name, organization = org, role = 'owner') {
  await root();
  people[name] = (
    await query('select private.provision_member($1,$2,$3,$4,$5::text[]) id', [
      organization,
      actors[name],
      name,
      organization === org ? 'Office' : 'Other office',
      [role],
    ])
  ).rows[0].id;
  return people[name];
}
async function profile(name) {
  await root();
  return (
    await query('select profile_id from public.auth_identities where auth_user_id=$1', [
      actors[name],
    ])
  ).rows[0]?.profile_id;
}

try {
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
 create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,confirmation_sent_at timestamptz,banned_until timestamptz,deleted_at timestamptz,raw_user_meta_data jsonb default '{}'::jsonb);
 create table auth.identities(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id),provider text,identity_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
  for (const file of [
    '202610250001_core.sql',
    '202610250002_access.sql',
    '202610250003_workspace_read.sql',
    '202610250004_commands.sql',
    '202610250005_role_access.sql',
  ]) {
    await db.exec(await readFile(new URL(`../migrations/${file}`, import.meta.url), 'utf8'));
  }
  await auth('admin');
  await auth('staff');
  await auth('executive');
  await auth('outside');
  org = (
    await query(
      "select private.bootstrap_workspace($1,'Personnel test','Admin','Office',array['secretary']) id",
      [actors.admin],
    )
  ).rows[0].id;
  people.admin = await profile('admin');
  await provision('staff');
  await provision('executive', org, 'executive');
  otherOrg = (
    await query(
      "select private.bootstrap_workspace($1,'Other tenant','Original global name','Other office',array['secretary']) id",
      [actors.outside],
    )
  ).rows[0].id;
  people.outside = await profile('outside');
  await query('select private.bootstrap_admin($1,$2)', ['admin@example.test', org]);
  const before = (await query('select count(*)::int n from public.organization_memberships'))
    .rows[0].n;
  const migration = await readFile(
    new URL('../migrations/202610250006_personnel.sql', import.meta.url),
    'utf8',
  );
  await db.exec(migration);

  await check('upgrade preserves memberships and advertises the personnel capability', async () => {
    assert.equal(
      (await query('select count(*)::int n from public.organization_memberships')).rows[0].n,
      before,
    );
    await as('admin');
    assert.equal((await state()).features.personnelManagement, true);
  });
  await check(
    'Admin creates future personnel without creating an Auth account or active member',
    async () => {
      const payload = {
          ...seed,
          firstName: ' สมใจ ',
          lastName: ' ใจดี ',
          email: ' FUTURE@EXAMPLE.TEST ',
        },
        key = randomUUID();
      const added = await command('add_personnel', payload, key);
      invitations.future = added.id;
      assert.equal(added.status, 'pending');
      assert.deepEqual(await command('add_personnel', payload, key), added);
      await denied(
        () => command('add_personnel', { ...payload, role: 'admin' }, key),
        'IDEMPOTENCY_CONFLICT',
      );
      const s = await state(),
        p = s.users.find((p) => p.id === added.id);
      assert.equal(p.name, 'สมใจ ใจดี');
      assert.equal(p.email, 'future@example.test');
      assert.equal(p.membershipStatus, 'pending');
      assert.deepEqual(s.access.members[p.id], { role: 'staff', version: 1 });
      assert(!s.eligibleOwners.some((o) => o.id === p.id));
      await root();
      assert.equal(
        (await query("select count(*)::int n from auth.users where email='future@example.test'"))
          .rows[0].n,
        0,
      );
      assert.equal(
        (await query('select count(*)::int n from public.organization_memberships')).rows[0].n,
        before,
      );
      assert.equal(
        (
          await query(
            "select count(*)::int n from private.audit_events where operation='add_personnel' and entity_id=$1",
            [p.id],
          )
        ).rows[0].n,
        1,
      );
    },
  );
  await check(
    'direct RPC requires Admin; cross-organization and forged fields are rejected',
    async () => {
      for (const actor of ['staff', 'executive', 'outside']) {
        await as(actor);
        await denied(
          () => command('add_personnel', { ...seed, email: 'unauthorized@example.test' }),
          'FORBIDDEN',
        );
      }
      await as('admin');
      await denied(() => command('add_personnel', seed, randomUUID(), otherOrg), 'FORBIDDEN');
      for (const value of [
        { actorId: people.admin },
        { organizationId: otherOrg },
        { status: 'active' },
        { profileId: people.staff },
      ]) {
        await denied(() => command('add_personnel', { ...seed, ...value }), 'VALIDATION_FAILED');
      }
    },
  );
  await check(
    'validation accepts Thai names and rejects missing fields, bad types, controls and invalid units',
    async () => {
      for (const change of [
        { firstName: '' },
        { lastName: ' ' },
        { firstName: 7 },
        { email: 'broken' },
        { email: 'a b@example.test' },
        { firstName: 'bad\nname' },
        { firstName: 'a'.repeat(101) },
        { role: 'secretary' },
        { unit: '' },
      ]) {
        await denied(() => command('add_personnel', { ...seed, ...change }), 'VALIDATION_FAILED');
      }
      await denied(
        () =>
          command('add_personnel', {
            ...seed,
            email: 'unknownunit@example.test',
            unit: 'Other office',
          }),
        'INVALID_UNIT',
      );
      await root();
      await query(
        "insert into public.organization_units(organization_id,code,name_th,is_active) values($1,'disabled','Disabled',false)",
        [org],
      );
      await as('admin');
      await denied(
        () =>
          command('add_personnel', {
            ...seed,
            email: 'disabledunit@example.test',
            unit: 'Disabled',
          }),
        'INVALID_UNIT',
      );
    },
  );
  await check(
    'case-insensitive duplicate personnel and existing members cannot be inserted',
    async () => {
      await denied(
        () => command('add_personnel', { ...seed, email: 'FUTURE@example.test' }),
        'PERSONNEL_ALREADY_EXISTS',
      );
      await denied(
        () => command('add_personnel', { ...seed, email: 'staff@example.test' }),
        'MEMBER_ALREADY_EXISTS',
      );
      await root();
      await query(
        "update public.organization_memberships set status='suspended',revoked_at=now() where organization_id=$1 and profile_id=$2",
        [org, people.staff],
      );
      await as('admin');
      await denied(
        () => command('add_personnel', { ...seed, email: 'STAFF@example.test' }),
        'MEMBER_ALREADY_EXISTS',
      );
      await root();
      await query(
        "update public.organization_memberships set status='active',revoked_at=null where organization_id=$1 and profile_id=$2",
        [org, people.staff],
      );
    },
  );
  await check(
    'pending role changes enforce optimistic version, idempotency and organization scope',
    async () => {
      await as('admin');
      const payload = { invitationId: invitations.future, role: 'executive', expectedVersion: 1 },
        key = randomUUID();
      const changed = await command('set_pending_personnel_role', payload, key);
      assert.equal(changed.version, 2);
      assert.deepEqual(await command('set_pending_personnel_role', payload, key), changed);
      await denied(
        () => command('set_pending_personnel_role', { ...payload, role: 'admin' }, key),
        'IDEMPOTENCY_CONFLICT',
      );
      await denied(() => command('set_pending_personnel_role', payload), 'STALE_VERSION');
      await denied(
        () => command('set_pending_personnel_role', { ...payload, invitationId: people.staff }),
        'NOT_FOUND',
      );
      await denied(
        () =>
          command('set_member_role', {
            profileId: invitations.future,
            role: 'admin',
            expectedVersion: 2,
          }),
        'INACTIVE_MEMBER',
      );
      await as('outside');
      await denied(
        () => command('set_pending_personnel_role', { ...payload, expectedVersion: 2 }),
        'FORBIDDEN',
      );
    },
  );
  await check('pending people and email addresses are hidden from non-Admin readers', async () => {
    await as('admin');
    await command('set_role_pages', {
      role: 'executive',
      pages: ['team'],
      expectedVersion: (await state()).access.policyVersion,
    });
    for (const actor of ['staff', 'executive']) {
      await as(actor);
      const s = await state();
      assert(!s.users.some((p) => p.membershipStatus === 'pending'));
      assert(!Object.keys(s.access.members).includes(invitations.future));
      assert(!JSON.stringify(s).includes('future@example.test'));
      assert(s.users.every((p) => p.id === people[actor] || !p.email));
    }
  });
  await check(
    'unverified signup and autoconfirmed email cannot claim, even with forged user metadata',
    async () => {
      await auth('future', { confirmed: false, identityVerified: false });
      await as('future');
      assert.deepEqual(await claim(), { claimed: 0, emailVerified: false });
      await denied(() => state(), 'NO_MEMBERSHIP');
      await root();
      await query(
        'update auth.users set email_confirmed_at=now(),raw_user_meta_data=$2::jsonb where id=$1',
        [
          actors.future,
          JSON.stringify({ email_verified: true, email: 'future@example.test', role: 'admin' }),
        ],
      );
      await as('future');
      assert.deepEqual(await claim(), { claimed: 0, emailVerified: false });
      assert.equal(await profile('future'), undefined);
    },
  );
  await check(
    'verification requires the Auth identity email to match current canonical email',
    async () => {
      await root();
      await query('update auth.identities set identity_data=$2::jsonb where user_id=$1', [
        actors.future,
        JSON.stringify({ email: 'wrong@example.test', email_verified: true }),
      ]);
      await as('future');
      assert.deepEqual(await claim(), { claimed: 0, emailVerified: false });
      await root();
      await query('update auth.identities set identity_data=$2::jsonb where user_id=$1', [
        actors.future,
        JSON.stringify({ email: 'future@example.test', email_verified: 'true' }),
      ]);
      await as('future');
      assert.deepEqual(await claim(), { claimed: 0, emailVerified: false });
    },
  );
  await check(
    'verified signup claims the configured role once, preserving immutable audit and no duplicate members',
    async () => {
      await root();
      await query('update auth.identities set identity_data=$2::jsonb where user_id=$1', [
        actors.future,
        JSON.stringify({ email: 'FUTURE@example.test', email_verified: true }),
      ]);
      await as('future');
      assert.deepEqual(await claim(), { claimed: 1, emailVerified: true });
      const s = await state();
      people.future = s.state.currentUserId;
      assert.equal(s.access.role, 'executive');
      assert.equal(s.users.find((p) => p.id === people.future).name, 'สมใจ ใจดี');
      assert.equal(s.users.find((p) => p.id === people.future).membershipStatus, 'active');
      assert.deepEqual(await claim(), { claimed: 0, emailVerified: true });
      await as('admin');
      await denied(
        () =>
          command('set_pending_personnel_role', {
            invitationId: invitations.future,
            role: 'admin',
            expectedVersion: 3,
          }),
        'INVITATION_CLAIMED',
      );
      await denied(() => command('add_personnel', seed), 'PERSONNEL_ALREADY_EXISTS');
      assert(!(await state()).users.some((p) => p.id === invitations.future));
      await root();
      assert.equal(
        (
          await query(
            "select count(*)::int n from private.audit_events where operation='claim_personnel' and entity_id=$1",
            [invitations.future],
          )
        ).rows[0].n,
        1,
      );
      assert.equal(
        (
          await query(
            'select count(*)::int n from public.organization_memberships where profile_id=$1',
            [people.future],
          )
        ).rows[0].n,
        1,
      );
    },
  );
  await check(
    'password-change-cleared confirmation timestamp does not invalidate verified identity proof',
    async () => {
      await invite('passwordchanged');
      await auth('passwordchanged');
      await query('update auth.users set confirmation_sent_at=null where id=$1', [
        actors.passwordchanged,
      ]);
      await as('passwordchanged');
      assert.equal((await claim()).claimed, 1);
    },
  );
  await check(
    'existing profile in another organization gains only the invited membership and keeps original global name',
    async () => {
      await as('admin');
      invitations.outside = (
        await command('add_personnel', {
          ...seed,
          email: 'outside@example.test',
          firstName: 'Local',
          lastName: 'Name',
          role: 'staff',
        })
      ).id;
      await as('outside');
      assert.equal((await claim()).claimed, 1);
      const local = await state(),
        remote = await state(otherOrg);
      assert.equal(local.state.currentUserId, people.outside);
      assert.equal(local.access.role, 'staff');
      assert.equal(local.users.find((p) => p.id === people.outside).name, 'Local Name');
      assert.equal(remote.access.role, 'user');
      assert.equal(remote.users.find((p) => p.id === people.outside).name, 'Original global name');
      await root();
      assert.equal(
        (await query('select display_name from public.profiles where id=$1', [people.outside]))
          .rows[0].display_name,
        'Original global name',
      );
    },
  );
  await check(
    'no invitation means verified signup receives no profile, membership or implicit role',
    async () => {
      await auth('stranger');
      await as('stranger');
      assert.deepEqual(await claim(), { claimed: 0, emailVerified: true });
      await denied(() => state(), 'NO_MEMBERSHIP');
      assert.equal(await profile('stranger'), undefined);
    },
  );
  await check('banned and deleted Auth users cannot claim pending personnel', async () => {
    for (const [name, column] of [
      ['banned', 'banned_until'],
      ['deleted', 'deleted_at'],
    ]) {
      await invite(name);
      await auth(name);
      await query(`update auth.users set ${column}=now()+interval '1 day' where id=$1`, [
        actors[name],
      ]);
      await as(name);
      assert.equal((await claim()).claimed, 0);
      assert.equal(await profile(name), undefined);
    }
  });
  await check(
    'disabled identities and profiles in another organization never get revived',
    async () => {
      for (const name of ['disabledidentity', 'disabledprofile']) {
        await invite(name);
        await auth(name);
        await provision(name, otherOrg);
        if (name === 'disabledidentity')
          await query('select private.disable_identity($1,$2)', [actors[name], 'fixture']);
        else
          await query('update public.profiles set disabled_at=now() where id=$1', [people[name]]);
        await as(name);
        assert.equal((await claim()).claimed, 0);
        await root();
        assert.equal(
          (
            await query(
              'select count(*)::int n from public.organization_memberships where organization_id=$1 and profile_id=$2',
              [org, people[name]],
            )
          ).rows[0].n,
          0,
        );
      }
    },
  );
  await check(
    'memberships created after reservation are never overwritten or revived',
    async () => {
      for (const name of ['suspended', 'revoked', 'expired', 'alreadymember']) {
        await invite(name, 'admin');
        await auth(name);
        await provision(name);
        if (name === 'suspended')
          await query(
            "update public.organization_memberships set status='suspended' where organization_id=$1 and profile_id=$2",
            [org, people[name]],
          );
        if (name === 'revoked')
          await query(
            'update public.organization_memberships set revoked_at=now() where organization_id=$1 and profile_id=$2',
            [org, people[name]],
          );
        if (name === 'expired')
          await query(
            "update public.organization_memberships set valid_from=now()-interval '2 days',valid_to=now()-interval '1 day' where organization_id=$1 and profile_id=$2",
            [org, people[name]],
          );
        await as(name);
        assert.equal((await claim()).claimed, 0);
        await root();
        assert.equal(
          (
            await query(
              'select count(*)::int n from private.member_access_roles where organization_id=$1 and profile_id=$2',
              [org, people[name]],
            )
          ).rows[0].n,
          0,
        );
        assert.equal(
          (
            await query('select claimed_at from private.personnel_invitations where id=$1', [
              invitations[name],
            ])
          ).rows[0].claimed_at,
          null,
        );
      }
    },
  );
  await check('duplicate canonical Auth email is ambiguous and cannot claim', async () => {
    await invite('ambiguous');
    await auth('ambiguous');
    await auth('duplicate', { email: 'AMBIGUOUS@example.test' });
    await as('ambiguous');
    assert.equal((await claim()).claimed, 0);
    assert.equal(await profile('ambiguous'), undefined);
  });
  await check(
    'inactive organization or unit pauses claims without creating an orphan profile',
    async () => {
      for (const name of ['inactiveorg', 'inactiveunit']) {
        await invite(name);
        await auth(name);
        if (name === 'inactiveorg')
          await query('update public.organizations set is_active=false where id=$1', [org]);
        else
          await query(
            'update public.organization_units set is_active=false where organization_id=$1',
            [org],
          );
        await as(name);
        assert.equal((await claim()).claimed, 0);
        assert.equal(await profile(name), undefined);
        await root();
        await query('update public.organizations set is_active=true where id=$1', [org]);
        await query(
          "update public.organization_units set is_active=true where organization_id=$1 and name_th='Office'",
          [org],
        );
      }
    },
  );
  await check(
    'pending Admin is not an active Admin and cannot bypass last-Admin protection',
    async () => {
      await invite('pendingadmin', 'admin');
      await as('admin');
      const version = (await state()).access.members[people.admin].version;
      await denied(
        () =>
          command('set_member_role', {
            profileId: people.admin,
            role: 'staff',
            expectedVersion: version,
          }),
        'LAST_ADMIN_REQUIRED',
      );
    },
  );
  await check(
    'pending personnel cannot coordinate or own tasks; claimed Staff participates in real workflows',
    async () => {
      const meeting = (
        await command('add_meeting', {
          title: 'Personnel workflow',
          number: '1',
          date: '2026-11-01',
          committee: 'Committee',
          time: '09:00',
          location: 'Room',
        })
      ).id;
      const draft = {
        title: 'Personnel resolution',
        content: 'Assign to verified personnel',
        meetingId: meeting,
        agenda: '1',
        type: 'action',
        unit: 'Office',
        coordinatorId: invitations.pendingadmin,
        closureCriteria: ['Verified result'],
      };
      await denied(() => command('add_resolution', draft), 'INVALID_ASSIGNEE');
      const resolution = (
        await command('add_resolution', { ...draft, coordinatorId: people.admin })
      ).id;
      await command('authorize_resolution', {
        id: resolution,
        expectedVersion: 1,
        reason: 'Start work',
      });
      const task = {
        resolutionId: resolution,
        title: 'New personnel task',
        description: 'Complete assigned work',
        deliverable: 'Evidence',
        ownerId: invitations.pendingadmin,
        reviewerId: people.admin,
        unit: 'Office',
        priority: 'normal',
        dueDate: '2026-12-01',
        required: true,
        criteria: ['Result checked'],
      };
      await denied(() => command('add_task', task), 'INVALID_ASSIGNEE');
      const owner = await profile('passwordchanged');
      await as('admin');
      assert((await state()).eligibleOwners.some((p) => p.id === owner));
      const assigned = (await command('add_task', { ...task, ownerId: owner })).id;
      await as('passwordchanged');
      const s = await state();
      assert.deepEqual(
        s.state.tasks.map((t) => t.id),
        [assigned],
      );
      await command('acknowledge_task', { id: assigned, expectedVersion: 1 });
      await as('staff');
      assert.deepEqual((await state()).state.tasks, []);
      await as('admin');
    },
  );
  await check('private storage, wrapped RPCs and anonymous claim are inaccessible', async () => {
    await denied(() => query('select * from private.personnel_invitations'), 'permission denied');
    await denied(
      () => query('select private.get_workspace_state_roles($1)', [org]),
      'permission denied',
    );
    await denied(
      () =>
        query('select private.workspace_command_roles($1,$2,$3::jsonb,$4)', [
          org,
          'mark_all_read',
          '{}',
          randomUUID(),
        ]),
      'permission denied',
    );
    await denied(
      () =>
        query('update auth.identities set identity_data=$1::jsonb', [
          JSON.stringify({ email_verified: true }),
        ]),
      'permission denied',
    );
    await root();
    await db.exec('set role anon');
    await denied(() => claim(), 'permission denied');
    await root();
    await db.exec('set role authenticated');
    await denied(() => claim(), 'UNAUTHENTICATED');
  });
  await check(
    'upgrade may be re-run without losing invitations, roles, audit or RPC wrappers',
    async () => {
      await root();
      const counts = async () =>
        (
          await query(
            'select (select count(*) from private.personnel_invitations)::int invitations,(select count(*) from private.member_access_roles)::int roles,(select count(*) from private.audit_events)::int audit',
          )
        ).rows[0];
      const before = await counts();
      await db.exec(migration);
      assert.deepEqual(await counts(), before);
      await as('admin');
      assert.equal((await state()).features.personnelManagement, true);
      await command('mark_all_read', {});
      await invite('afterrerun');
    },
  );
  console.log(`Personnel checks: ${checks} passed.`);
} finally {
  await db.close();
}
