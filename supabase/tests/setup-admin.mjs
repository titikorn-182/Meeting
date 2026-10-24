/** Run the delivered admin setup SQL against real migrations in isolated PostgreSQL WASM. */
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';

const db = new PGlite();
const query = (sql, parameters = []) => db.query(sql, parameters);
const names = ['generic', 'local', 'outside', 'signup', 'multiple', 'suspended', 'revoked', 'disabled', 'banned', 'duplicate'];
const actors = Object.fromEntries(names.map(name => [name, randomUUID()]));
const people = {};
const allPages = ['dashboard', 'meetings', 'resolutions', 'tasks', 'reviews', 'changes', 'reports', 'team', 'settings', 'notifications'];
let org, otherOrg, checks = 0;

async function check(name, run) {
  await run();
  checks++;
  console.log(`PASS ${name}`);
}

async function root() {
  await db.exec('reset role');
  await query("select set_config('request.jwt.claim.sub', '', false)");
}

async function accessState() {
  return {
    roles: (await query('select * from private.member_access_roles order by organization_id, profile_id')).rows,
    audit: (await query("select count(*)::int n from private.audit_events where operation='bootstrap_admin'")).rows[0].n,
    organizations: (await query('select id, is_active from public.organizations order by id')).rows,
    memberships: (await query('select * from public.organization_memberships order by id')).rows,
    identities: (await query('select * from public.auth_identities order by id')).rows,
    profiles: (await query('select * from public.profiles order by id')).rows,
  };
}

async function rejectedWithoutChanges(sql, expected) {
  await root();
  const before = await accessState();
  await assert.rejects(() => query(sql), error => error.message.includes(expected), expected);
  assert.deepEqual(await accessState(), before, 'Rejected setup must not grant or revive access');
}

function assertAccess(result, profileId) {
  assert.deepEqual(result.rows, [{
    organization_id: org,
    profile_id: profileId,
    access_role: 'admin',
    allowed_pages: allPages,
  }]);
}

async function successAndRepeat(sql, profileId) {
  await root();
  const before = await accessState();
  // PGlite query uses the extended protocol: a setup artifact must be one statement.
  assertAccess(await query(sql), profileId);
  const after = await accessState();
  assert.equal(after.audit, before.audit + 1);
  assert.equal(after.roles.find(row => row.profile_id === profileId && row.organization_id === org).role, 'admin');
  assert.deepEqual(after.organizations, before.organizations);
  assert.deepEqual(after.memberships, before.memberships);
  assert.deepEqual(after.identities, before.identities);
  assert.deepEqual(after.profiles, before.profiles);
  assertAccess(await query(sql), profileId);
  assert.deepEqual(await accessState(), after, 'Repeated setup must preserve version and audit count');
}

try {
  const generic = await readFile(new URL('../setup-admin.sql', import.meta.url), 'utf8');
  assert(generic.includes('YOUR_LOGIN_EMAIL'));
  assert(generic.includes('YOUR_ORGANIZATION_UUID'));
  const explicit = (name, organization = org) => generic
    .replaceAll('YOUR_LOGIN_EMAIL', `${name}@example.test`)
    .replaceAll('YOUR_ORGANIZATION_UUID', organization);

  let local;
  try {
    const source = await readFile(new URL('../setup-admin.local.sql', import.meta.url), 'utf8');
    const emailLiteral = /'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+'/g;
    assert.equal(source.match(emailLiteral)?.length, 1, 'Local setup must contain exactly one target email literal');
    // The ignored personal artifact is sanitized in memory; never log or execute its target email.
    local = source.replace(emailLiteral, "'TEST_TARGET_EMAIL'");
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    console.log('SKIP personal setup checks: intentionally untracked setup-admin.local.sql is absent');
  }
  const automatic = name => local.replaceAll('TEST_TARGET_EMAIL', `${name}@example.test`);

  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; create table auth.users(id uuid primary key, email text, banned_until timestamptz, deleted_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
  for (const file of ['202610250001_core.sql', '202610250002_access.sql', '202610250003_workspace_read.sql', '202610250004_commands.sql', '202610250005_role_access.sql']) {
    await db.exec(await readFile(new URL(`../migrations/${file}`, import.meta.url), 'utf8'));
  }
  for (const [name, id] of Object.entries(actors)) {
    await query('insert into auth.users(id, email) values($1, $2)', [id, `${name}@example.test`]);
  }
  org = (await query("select private.bootstrap_workspace($1, 'Setup target', 'Generic candidate', 'Office', array['secretary']) id", [actors.generic])).rows[0].id;
  otherOrg = (await query("select private.bootstrap_workspace($1, 'Other workspace', 'Outside candidate', 'Office', array['secretary']) id", [actors.outside])).rows[0].id;
  people.generic = (await query('select profile_id from public.auth_identities where auth_user_id=$1', [actors.generic])).rows[0].profile_id;
  for (const name of ['local', 'multiple', 'suspended', 'revoked', 'disabled', 'banned', 'duplicate']) {
    people[name] = (await query('select private.provision_member($1, $2, $3, $4, $5::text[]) id', [org, actors[name], name, 'Office', ['owner']])).rows[0].id;
  }
  await query('select private.provision_member($1, $2, $3, $4, $5::text[])', [otherOrg, actors.multiple, 'Multiple', 'Office', ['owner']]);
  await query("update public.organization_memberships set status='suspended' where organization_id=$1 and profile_id=$2", [org, people.suspended]);
  await query('update public.organization_memberships set revoked_at=now() where organization_id=$1 and profile_id=$2', [org, people.revoked]);
  await query("select private.disable_identity($1, 'Setup rejection fixture')", [actors.disabled]);
  await query("update auth.users set banned_until=now()+interval '1 day' where id=$1", [actors.banned]);
  // Simulate a case-insensitive Auth collision without changing the application's schema.
  await query('insert into auth.users(id, email) values($1, $2)', [randomUUID(), 'DUPLICATE@example.test']);

  await check('generic setup is one statement, returns granted access, and is idempotent', async () => {
    await successAndRepeat(explicit('GENERIC'), people.generic);
  });
  for (const [name, error] of [
    ['missing', 'AUTH_EMAIL_MUST_MATCH_EXACTLY_ONE_USER'],
    ['signup', 'ACTIVE_EXISTING_IDENTITY_REQUIRED'],
    ['outside', 'ACTIVE_EXISTING_MEMBERSHIP_REQUIRED'],
    ['suspended', 'ACTIVE_EXISTING_MEMBERSHIP_REQUIRED'],
    ['revoked', 'ACTIVE_EXISTING_MEMBERSHIP_REQUIRED'],
    ['disabled', 'ACTIVE_EXISTING_IDENTITY_REQUIRED'],
    ['banned', 'BLOCKED_AUTH_USER'],
    ['duplicate', 'AUTH_EMAIL_MUST_MATCH_EXACTLY_ONE_USER'],
  ]) {
    await check(`generic setup rejects ${name} without changing access`, () => rejectedWithoutChanges(explicit(name), error));
  }

  if (local) {
    await check('personal setup selects the single active workspace and is idempotent', async () => {
      await successAndRepeat(automatic('LOCAL'), people.local);
    });
    for (const name of ['missing', 'signup', 'multiple', 'suspended', 'revoked', 'disabled', 'banned']) {
      await check(`personal setup rejects ${name} without changing access`, () => rejectedWithoutChanges(automatic(name), 'EXPLICIT_EMAIL_AND_ORGANIZATION_REQUIRED'));
    }
    await check('personal setup rejects duplicate Auth emails even with one candidate workspace', () => rejectedWithoutChanges(automatic('duplicate'), 'AUTH_EMAIL_MUST_MATCH_EXACTLY_ONE_USER'));
    await check('personal setup ignores inactive memberships when exactly one active workspace remains', async () => {
      await query('update public.organization_memberships set revoked_at=now() where organization_id=$1 and profile_id=$2', [otherOrg, people.multiple]);
      await successAndRepeat(automatic('multiple'), people.multiple);
    });
  }

  for (const role of ['anon', 'authenticated']) {
    await check(`${role} cannot run administrator setup`, async () => {
      await root();
      const before = await accessState();
      await query("select set_config('request.jwt.claim.sub', $1, false)", [actors.local]);
      await db.exec(`set role ${role}`);
      try {
        await assert.rejects(() => query(explicit('local')), error => error.message.includes('permission denied'));
        if (local) await assert.rejects(() => query(automatic('local')), error => error.message.includes('permission denied'));
      } finally {
        await root();
      }
      assert.deepEqual(await accessState(), before);
    });
  }

  console.log(`\n${checks} setup-admin checks passed in isolated PostgreSQL. No hosted database was changed.`);
} catch (error) {
  console.error(error.message, error.where ?? '');
  process.exitCode = 1;
} finally {
  await db.close();
}
