/** Real migrations + setup SQL in isolated PostgreSQL WASM; no credentials or network. */
import { PGlite } from '@electric-sql/pglite';
import { readdir, readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';

const db = new PGlite();
const setup = await readFile(new URL('../setup-secretary.sql', import.meta.url), 'utf8');
const query = (sql, parameters = []) => db.query(sql, parameters);
const literal = value => `'${value.replaceAll("'", "''")}'`;
let checks = 0;
async function check(name, run) { await run(); checks++; console.log(`PASS ${name}`); }
async function user(email = `${randomUUID()}@example.test`) {
  const id = randomUUID();
  await query('insert into auth.users(id,email) values($1,$2)', [id, email]);
  return { id, email };
}
async function execute(email, org = null, unit = 'สำนักงาน') {
  const sql = setup.replace("'YOUR_LOGIN_EMAIL'", literal(email))
    .replace('target_organization_id uuid := null;', `target_organization_id uuid := ${org ? `${literal(org)}::uuid` : 'null'};`)
    .replace("unit_name text := 'สำนักงาน';", `unit_name text := ${literal(unit)};`);
  return executeSql(sql);
}
async function executeSql(sql) {
  try {
    const results = await db.exec(sql);
    return results.find(result => result.rows[0]?.organization_id)?.rows[0];
  } catch (error) {
    await db.exec('rollback');
    throw error;
  }
}
async function state() {
  const result = {};
  for (const table of ['organizations', 'profiles', 'auth_identities', 'organization_memberships', 'organization_units', 'access_grants']) {
    result[table] = (await query(`select * from public.${table} order by id`)).rows;
  }
  return result;
}
async function denied(email, org, message, unit) {
  const before = await state();
  await assert.rejects(() => execute(email, org, unit), error => error.message.includes(message));
  assert.deepEqual(await state(), before, 'Refusal must not change authorization or organizations');
}
async function provision(org, actor, role = 'owner', unit = 'สำนักงาน') {
  return (await query('select private.provision_member($1,$2,$3,$4,$5::text[]) as id', [org, actor.id, 'Test member', unit, [role]])).rows[0].id;
}

try {
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
  for (const filename of (await readdir(new URL('../migrations/', import.meta.url))).filter(name => name.endsWith('.sql')).sort()) {
    await db.exec(await readFile(new URL(`../migrations/${filename}`, import.meta.url), 'utf8'));
  }
  await check('untouched email placeholder is rejected without mutations', async () => {
    const before = await state();
    await assert.rejects(() => executeSql(setup), error => error.message.includes('TARGET_EMAIL_REQUIRED'));
    assert.deepEqual(await state(), before);
  });
  await check('empty email is rejected without mutations', async () => {
    await denied('', null, 'TARGET_EMAIL_REQUIRED');
  });
  const first = await user('Secretary@Example.test');
  let initial;
  await check('first setup creates one organization and secretary for case-insensitive email', async () => {
    initial = await execute('secretary@example.TEST');
    assert.equal(initial.organization_name, 'POLUBU Smart meeting');
    assert.equal(initial.secretary_access, true);
    assert.equal((await query('select count(*)::int as count from public.organizations')).rows[0].count, 1);
    assert.deepEqual((await query('select role_code from public.access_grants')).rows, [{ role_code: 'secretary' }]);
  });
  const org = initial.organization_id;
  await check('authenticated secretary can read the empty workspace through the actual RPC', async () => {
    await query("select set_config('request.jwt.claim.sub',$1,false)", [first.id]);
    await db.exec('set role authenticated');
    try {
      const snapshot = (await query('select public.get_workspace_state($1) as data', [org])).rows[0].data;
      assert.deepEqual(snapshot.roles, ['secretary', 'owner']);
      assert.equal(snapshot.access.role, 'user');
      assert.equal(snapshot.state.currentUserId, initial.profile_id);
      assert(snapshot.users.some(person => person.id === snapshot.state.currentUserId));
      assert.deepEqual(snapshot.state.tasks, []);
      assert.deepEqual(snapshot.state.resolutions, []);
      assert.deepEqual(snapshot.state.meetings, []);
    } finally {
      await db.exec('reset role');
      await query("select set_config('request.jwt.claim.sub','',false)");
    }
  });
  await check('second run changes no organization, identity, membership or grant', async () => {
    const before = await state();
    assert.deepEqual(await execute(first.email), initial);
    assert.deepEqual(await state(), before);
  });
  await check('full-file Replace All accepts the real email and keeps authenticated workspace access', async () => {
    const before = await state();
    assert.deepEqual(await executeSql(setup.replaceAll('YOUR_LOGIN_EMAIL', first.email)), initial);
    assert.deepEqual(await state(), before);
    await query("select set_config('request.jwt.claim.sub',$1,false)", [first.id]);
    await db.exec('set role authenticated');
    try {
      const snapshot = (await query('select public.get_workspace_state($1) as data', [org])).rows[0].data;
      assert.deepEqual(snapshot.roles, ['secretary', 'owner']);
      assert.equal(snapshot.access.role, 'user');
      assert.equal(snapshot.state.currentUserId, initial.profile_id);
      assert(snapshot.users.some(person => person.id === initial.profile_id));
      assert.deepEqual(snapshot.state.tasks, []);
    } finally {
      await db.exec('reset role');
      await query("select set_config('request.jwt.claim.sub','',false)");
    }
  });
  await check('existing sole organization is reused for another Auth account', async () => {
    const actor = await user();
    assert.equal((await execute(actor.email)).organization_id, org);
    assert.equal((await query('select count(*)::int as count from public.organizations')).rows[0].count, 1);
  });
  await check('valid finite secretary grant remains unchanged with original expiry', async () => {
    await query("update public.access_grants set valid_to = now() + interval '2 days' where profile_id = $1", [initial.profile_id]);
    const before = await state();
    assert.equal((await execute(first.email, org)).secretary_access, true);
    assert.deepEqual(await state(), before);
  });
  await check('existing member retains current unit and other roles when secretary is added', async () => {
    await query("insert into public.organization_units(organization_id,code,name_th) values($1,'other','ฝ่ายอื่น')", [org]);
    const actor = await user();
    const person = await provision(org, actor, 'reviewer', 'ฝ่ายอื่น');
    const membership = (await query('select * from public.organization_memberships where profile_id=$1', [person])).rows[0];
    assert.equal((await execute(actor.email, org)).secretary_access, true);
    assert.deepEqual((await query('select * from public.organization_memberships where profile_id=$1', [person])).rows[0], membership);
    assert.deepEqual((await query('select role_code from public.access_grants where profile_id=$1 order by role_code', [person])).rows, [{ role_code: 'reviewer' }, { role_code: 'secretary' }]);
  });
  for (const [name, change] of [
    ['revoked', 'revoked_at = now()'], ['suspended', "status = 'suspended'"],
    ['finite', "valid_to = now() + interval '2 days'"], ['expired', "valid_from = now() - interval '2 days', valid_to = now() - interval '1 day'"],
    ['future', "valid_from = now() + interval '1 day'"],
  ]) {
    await check(`${name} membership is refused without reactivation or extension`, async () => {
      const actor = await user();
      const person = await provision(org, actor);
      await query(`update public.organization_memberships set ${change} where profile_id=$1`, [person]);
      await denied(actor.email, org, 'EXISTING_MEMBERSHIP_REQUIRES_ADMIN_REVIEW');
    });
  }
  for (const [name, change] of [
    ['revoked', 'revoked_at = now()'],
    ['expired', "valid_from = now() - interval '2 days', valid_to = now() - interval '1 day'"],
    ['future', "valid_from = now() + interval '1 day'"],
  ]) {
    await check(`${name} secretary grant is refused without adding a replacement`, async () => {
      const actor = await user();
      const person = await provision(org, actor, 'secretary');
      await query(`update public.access_grants set ${change} where profile_id=$1`, [person]);
      await denied(actor.email, org, 'EXISTING_SECRETARY_GRANT_REQUIRES_ADMIN_REVIEW');
    });
  }
  for (const table of ['auth_identities', 'profiles']) {
    await check(`disabled ${table} is refused`, async () => {
      const actor = await user();
      const person = await provision(org, actor);
      await query(`update public.${table} set disabled_at=now() where ${table === 'profiles' ? 'id' : 'profile_id'}=$1`, [person]);
      await denied(actor.email, org, 'DISABLED_IDENTITY_OR_PROFILE_REQUIRES_ADMIN_REVIEW');
    });
  }
  await check('absent and ambiguous Auth emails are refused', async () => {
    await denied('absent@example.test', org, 'AUTH_EMAIL_MUST_MATCH_EXACTLY_ONE_USER');
    await user('duplicate@example.test'); await user('DUPLICATE@example.test');
    await denied('duplicate@example.test', org, 'AUTH_EMAIL_MUST_MATCH_EXACTLY_ONE_USER');
  });
  await check('unknown or inactive organization never creates another organization', async () => {
    await denied(first.email, randomUUID(), 'TARGET_ORGANIZATION_NOT_FOUND_OR_INACTIVE');
    await query('update public.organizations set is_active=false where id=$1', [org]);
    await denied(first.email, org, 'TARGET_ORGANIZATION_NOT_FOUND_OR_INACTIVE');
    await denied(first.email, null, 'EXISTING_ORGANIZATION_INACTIVE');
    await query('update public.organizations set is_active=true where id=$1', [org]);
  });
  await check('missing configured unit with multiple active units is refused', async () => {
    const actor = await user();
    await denied(actor.email, org, 'EXISTING_ACTIVE_UNIT_REQUIRED_SET_UNIT_NAME', 'Missing unit');
  });
  await check('inactive membership unit is refused without moving the member', async () => {
    const actor = await user();
    await provision(org, actor, 'owner', 'ฝ่ายอื่น');
    await query("update public.organization_units set is_active=false where organization_id=$1 and name_th='ฝ่ายอื่น'", [org]);
    await denied(actor.email, org, 'MEMBERSHIP_UNIT_MISSING_OR_INACTIVE');
    const newcomer = await user();
    await denied(newcomer.email, org, 'CONFIGURED_UNIT_INACTIVE', 'ฝ่ายอื่น');
  });
  await check('sole active unit is reused when configured name is absent', async () => {
    const actor = await user();
    const result = await execute(actor.email, org, 'Missing unit');
    assert.equal(result.secretary_access, true);
    assert.equal((await query('select u.name_th from public.organization_memberships m join public.organization_units u on u.id=m.unit_id where m.profile_id=$1', [result.profile_id])).rows[0].name_th, 'สำนักงาน');
  });
  await check('multiple organizations require explicit selection; explicit choice remains idempotent', async () => {
    const other = await user();
    await query("select private.bootstrap_workspace($1,'Second organization','Other secretary','Other unit')", [other.id]);
    await denied(first.email, null, 'MULTIPLE_ORGANIZATIONS_SET_TARGET_ORGANIZATION_ID');
    const before = await state();
    assert.equal((await execute(first.email, org)).organization_id, org);
    assert.deepEqual(await state(), before);
  });
  console.log(`${checks} setup-secretary checks passed.`);
} finally {
  await db.close();
}
