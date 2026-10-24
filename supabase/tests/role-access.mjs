/** Authorization regression tests against real SQL in local PostgreSQL WASM.
 * PGlite queues transactions; true multi-connection lock contention is a hosted smoke test.
 */
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';

const db = new PGlite();
const query = (sql, parameters = []) => db.query(sql, parameters);
const actors = Object.fromEntries(['admin','user','executive','staff','staff2','reviewer','empty','outside','signup','suspended','disabled','banned'].map(name => [name, randomUUID()]));
const people = {};
let org, otherOrg, meeting, resolution, ownTask, siblingTask, ownChange, otherChange, checks = 0;
const allPages = ['dashboard','meetings','resolutions','tasks','reviews','changes','reports','team','settings','notifications'];
const userPages = ['dashboard','meetings','resolutions','tasks','changes','notifications'];
async function root() { await db.exec('reset role'); await query("select set_config('request.jwt.claim.sub','',false)"); }
async function as(name) { await root(); await query("select set_config('request.jwt.claim.sub',$1,false)", [actors[name]]); await db.exec('set role authenticated'); }
async function state(organization = org) { return (await query('select public.get_workspace_state($1) data', [organization])).rows[0].data; }
async function command(operation, payload, key = randomUUID(), organization = org) {
 return (await query('select public.workspace_command($1,$2,$3::jsonb,$4) data', [organization,operation,JSON.stringify(payload),key])).rows[0].data;
}
async function denied(run, expected) { await assert.rejects(run, error => error.message.includes(expected), expected); }
async function check(name, run) { await run(); checks++; console.log(`PASS ${name}`); }
async function assign(name, role) {
 const s = await state();
 return command('set_member_role', { profileId: people[name], role, expectedVersion: s.access.members[people[name]].version });
}
async function pages(role, values) { return command('set_role_pages', { role, pages: values, expectedVersion: (await state()).access.policyVersion }); }

try {
 await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
 create schema auth; create table auth.users(id uuid primary key,email text,banned_until timestamptz,deleted_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
 for (const name of ['202610250001_core.sql','202610250002_access.sql','202610250003_workspace_read.sql','202610250004_commands.sql']) {
  await db.exec(await readFile(new URL(`../migrations/${name}`, import.meta.url), 'utf8'));
 }
 for (const [name,id] of Object.entries(actors)) await query('insert into auth.users(id,email) values($1,$2)', [id, `${name}@example.test`]);
 org = (await query("select private.bootstrap_workspace($1,'Role test','Admin candidate','Office',array['secretary']) id", [actors.admin])).rows[0].id;
 people.admin = (await query('select profile_id from public.auth_identities where auth_user_id=$1',[actors.admin])).rows[0].profile_id;
 for (const [name,roles] of Object.entries({user:['secretary'],executive:['executive'],staff:['owner','reviewer'],staff2:['owner'],reviewer:['reviewer'],empty:['owner'],suspended:['owner'],disabled:['owner'],banned:['owner']})) {
  people[name]=(await query('select private.provision_member($1,$2,$3,$4,$5::text[]) id',[org,actors[name],name,'Office',roles])).rows[0].id;
 }
 otherOrg = (await query("select private.bootstrap_workspace($1,'Other tenant','Outside','Other office',array['secretary']) id", [actors.outside])).rows[0].id;
 people.outside = (await query('select profile_id from public.auth_identities where auth_user_id=$1',[actors.outside])).rows[0].profile_id;
 await query('update public.access_grants set revoked_at=now() where profile_id=$1',[people.empty]);
 await as('admin');
 meeting=(await command('add_meeting',{title:'Existing meeting',number:'1',date:'2026-11-01',committee:'Committee',time:'09:00',location:'Room'})).id;
 resolution=(await command('add_resolution',{title:'Existing resolution',content:'Private complete resolution text',meetingId:meeting,agenda:'1',type:'action',unit:'Office',coordinatorId:people.user,closureCriteria:['Verified result']})).id;
 await as('executive'); await command('authorize_resolution',{id:resolution,expectedVersion:1,reason:'Private authorization reason'});
 await as('admin');
 const task = {resolutionId:resolution,title:'Own task',description:'Own description',deliverable:'Evidence',ownerId:people.staff,reviewerId:people.executive,unit:'Office',priority:'normal',dueDate:'2026-12-01',required:true,criteria:['Result checked']};
 ownTask=(await command('add_task',task)).id;
 siblingTask=(await command('add_task',{...task,title:'Other task secret',ownerId:people.staff2,reviewerId:people.staff})).id;
 await as('staff'); ownChange=(await command('create_change_request',{taskId:ownTask,type:'deadline',proposedValue:'2026-12-02',reason:'Own request',expectedVersion:1})).id;
 await as('user'); otherChange=(await command('create_change_request',{taskId:ownTask,type:'scope',proposedValue:'Private proposed scope',reason:'Other person request',expectedVersion:1})).id;
 await root();
 const before = (await query('select (select count(*) from public.task_cycles)::int tasks,(select count(*) from public.resolution_versions)::int resolutions,(select count(*) from private.audit_events)::int audit')).rows[0];
 const migration = await readFile(new URL('../migrations/202610250005_role_access.sql',import.meta.url),'utf8');
 await db.exec(migration);

 await check('upgrade preserves existing business records and never automatically creates admin', async()=>{
  assert.deepEqual((await query('select (select count(*) from public.task_cycles)::int tasks,(select count(*) from public.resolution_versions)::int resolutions,(select count(*) from private.audit_events)::int audit')).rows[0],before);
  assert.equal((await query('select count(*)::int n from private.member_access_roles')).rows[0].n,0);
  await as('admin'); assert.equal((await state()).access.role,'user');
  await as('reviewer'); assert.equal((await state()).access.role,'staff');
  await as('signup'); await denied(()=>state(),'NO_MEMBERSHIP');
  await as('empty'); await denied(()=>state(),'NO_MEMBERSHIP');
 });
 await check('bootstrap requires an explicit existing email, organization and active membership', async()=>{
  await root();
  await denied(()=>query('select private.bootstrap_admin($1,$2)',['admin@example.test',null]),'EXPLICIT_EMAIL_AND_ORGANIZATION_REQUIRED');
  await denied(()=>query('select private.bootstrap_admin($1,$2)',['missing@example.test',org]),'AUTH_EMAIL_MUST_MATCH_EXACTLY_ONE_USER');
  await denied(()=>query('select private.bootstrap_admin($1,$2)',['signup@example.test',org]),'ACTIVE_EXISTING_IDENTITY_REQUIRED');
  await denied(()=>query('select private.bootstrap_admin($1,$2)',['outside@example.test',org]),'ACTIVE_EXISTING_MEMBERSHIP_REQUIRED');
  await query("update public.organization_memberships set status='suspended' where organization_id=$1 and profile_id=$2",[org,people.suspended]);
  await denied(()=>query('select private.bootstrap_admin($1,$2)',['suspended@example.test',org]),'ACTIVE_EXISTING_MEMBERSHIP_REQUIRED');
  await query('select private.disable_identity($1,$2)',[actors.disabled,'fixture']);
  await denied(()=>query('select private.bootstrap_admin($1,$2)',['disabled@example.test',org]),'ACTIVE_EXISTING_IDENTITY_REQUIRED');
  await query("update auth.users set banned_until=now()+interval '1 day' where id=$1",[actors.banned]);
  await denied(()=>query('select private.bootstrap_admin($1,$2)',['banned@example.test',org]),'BLOCKED_AUTH_USER');
  await query('select private.bootstrap_admin($1,$2)',['ADMIN@example.TEST',org]);
  const version=(await query('select version from private.member_access_roles where profile_id=$1',[people.admin])).rows[0].version;
  await query('select private.bootstrap_admin($1,$2)',['admin@example.test',org]);
  assert.equal((await query('select version from private.member_access_roles where profile_id=$1',[people.admin])).rows[0].version,version);
  assert.equal((await query('select count(*)::int n from public.organizations')).rows[0].n,2);
 });
 await check('all four roles expose canonical policy and capability contracts', async()=>{
  for(const [name,role] of [['admin','admin'],['user','user'],['executive','executive'],['staff','staff']]) {
   await as(name);const s=await state();assert.equal(s.access.role,role);assert.equal(s.access.policyVersion,1);
   assert.deepEqual(s.access.pages,s.access.policies[role]);assert.deepEqual(s.access.policies.admin,allPages);
   assert.equal(s.access.members[people[name]].role,role);assert.equal(s.users.find(p=>p.id===people[name]).accessRole,role);
   assert.equal(s.permissions.includes('access.manage'),role==='admin');assert.equal(s.permissions.includes('workspace.read_all'),role!=='staff');
   if (role==='user'||role==='executive') {
    assert.deepEqual(s.access.pages,[]);
    for(const field of ['tasks','resolutions','meetings','changes','notifications','audit']) assert.deepEqual(s.state[field],[]);
    assert.deepEqual(s.users.map(p=>p.id),[people[name]]);assert.deepEqual(s.state.settings,{});assert.deepEqual(s.eligibleOwners,[]);
   }
  }
 });
 await as('admin');await pages('user',userPages);await pages('executive',['dashboard','meetings','resolutions','tasks','reviews','changes','reports','team','notifications']);
 await check('staff owns tasks strictly; obsolete reviewer grants cannot expose sibling tasks or people', async()=>{
  await as('staff');const s=await state();assert.deepEqual(s.state.tasks.map(t=>t.id),[ownTask]);
  assert.deepEqual(s.users.map(p=>p.id),[people.staff]);assert.deepEqual(Object.keys(s.access.members),[people.staff]);assert.deepEqual(s.eligibleOwners,[]);
  assert.deepEqual(s.state.changes.map(c=>c.id),[ownChange]);assert(!JSON.stringify(s).includes('Other person request'));assert(!JSON.stringify(s).includes('Other task secret'));
  assert.deepEqual(s.state.meetings,[]);assert.deepEqual(s.state.audit,[]);assert.deepEqual(s.state.settings,{});
  assert.deepEqual(Object.keys(s.state.resolutions[0]).sort(),['code','executionAuthorized','id','partialContext','status','title']);
  assert(s.state.notifications.every(n=>n.targetId===ownTask));
  await denied(()=>command('acknowledge_task',{id:siblingTask,expectedVersion:1}),'NOT_FOUND');
  await denied(()=>command('transition_task',{id:siblingTask,status:'accepted',expectedVersion:1,criterionResults:[true]}),'PAGE_ACCESS_DENIED');
 });
 await check('direct RPC administration rejects nonadmins, cross-tenant actors and forged target membership', async()=>{
  await as('executive');await denied(()=>command('set_member_role',{profileId:people.user,role:'admin',expectedVersion:0}),'FORBIDDEN');
  await denied(()=>command('set_role_pages',{role:'user',pages:allPages,expectedVersion:1}),'FORBIDDEN');
  await as('user');await denied(()=>command('set_member_role',{profileId:people.user,role:'admin',expectedVersion:0}),'PAGE_ACCESS_DENIED');
  await as('outside');await denied(()=>command('set_member_role',{profileId:people.user,role:'admin',expectedVersion:0}),'FORBIDDEN');await denied(()=>state(),'NO_MEMBERSHIP');
  await as('admin');await denied(()=>command('set_member_role',{profileId:people.outside,role:'admin',expectedVersion:0}),'INACTIVE_MEMBER');
  for(const name of ['suspended','disabled','banned']) await denied(()=>command('set_member_role',{profileId:people[name],role:'admin',expectedVersion:0}),'INACTIVE_MEMBER');
  await denied(()=>command('set_member_role',{profileId:people.user,role:'admin',expectedVersion:0,actorId:people.admin}),'VALIDATION_FAILED');
  await root();await query('update public.organization_memberships set revoked_at=now() where organization_id=$1 and profile_id=$2',[org,people.staff2]);
  await as('admin');await denied(()=>command('set_member_role',{profileId:people.staff2,role:'admin',expectedVersion:0}),'INACTIVE_MEMBER');
  await root();assert.equal((await query('select revoked_at is not null revoked from public.organization_memberships where organization_id=$1 and profile_id=$2',[org,people.staff2])).rows[0].revoked,true);
  await query('update public.organization_memberships set revoked_at=null where organization_id=$1 and profile_id=$2',[org,people.staff2]);
  await as('banned');await denied(()=>state(),'NO_MEMBERSHIP');await denied(()=>command('mark_all_read',{}),'UNAUTHENTICATED');
 });
 await check('private authorization tables and legacy RPCs remain unreachable to browser roles', async()=>{
  await as('admin');
  await denied(()=>query('select * from private.member_access_roles'),'permission denied');
  await denied(()=>query('select private.bootstrap_admin($1,$2)',['user@example.test',org]),'permission denied');
  await denied(()=>query('select private.workspace_command_legacy($1,$2,$3::jsonb,$4)',[org,'mark_all_read','{}',randomUUID()]),'permission denied');
  await denied(()=>query('select * from public.organization_memberships'),'permission denied');
 });
 await check('member overrides are optimistic, idempotent and immediately replace legacy privileges', async()=>{
  await as('admin');const payload={profileId:people.user,role:'staff',expectedVersion:0};const key=randomUUID();
  const first=await command('set_member_role',payload,key);assert.equal(first.version,1);assert.deepEqual(await command('set_member_role',payload,key),first);
  await denied(()=>command('set_member_role',{...payload,role:'executive'},key),'IDEMPOTENCY_CONFLICT');
  await denied(()=>command('set_member_role',{...payload,role:'executive'}),'STALE_VERSION');
  await as('user');const s=await state();assert.equal(s.access.role,'staff');assert(!s.permissions.includes('meeting.manage'));assert.deepEqual(s.state.tasks,[]);
  await denied(()=>command('add_meeting',{title:'Spoofed',role:'admin'}),'PAGE_ACCESS_DENIED');
  await as('admin');await assign('user','user');
  await command('set_member_role',{profileId:people.empty,role:'staff',expectedVersion:0});
  await as('empty');assert.equal((await state()).access.role,'staff');
 });
 await check('page disable filters read payloads and blocks direct business commands', async()=>{
  await as('admin');const payload={role:'user',pages:['notifications'],expectedVersion:(await state()).access.policyVersion},key=randomUUID();
  const result=await command('set_role_pages',payload,key);assert.equal(result.policyVersion,payload.expectedVersion+1);assert.deepEqual(await command('set_role_pages',payload,key),result);
  await denied(()=>command('set_role_pages',{...payload,pages:[]},key),'IDEMPOTENCY_CONFLICT');
  await denied(()=>command('set_role_pages',{...payload,pages:userPages}),'STALE_VERSION');
  await as('user');const s=await state();for(const field of ['meetings','resolutions','tasks','changes','audit']) assert.deepEqual(s.state[field],[],field);
  assert.deepEqual(s.state.settings,{});assert.deepEqual(s.users.map(p=>p.id),[people.user]);
  await denied(()=>command('add_meeting',{title:'Blocked'}),'PAGE_ACCESS_DENIED');
  await denied(()=>command('create_change_request',{taskId:ownTask,type:'scope',proposedValue:'Blocked',reason:'Blocked',expectedVersion:1}),'PAGE_ACCESS_DENIED');
  await as('admin');await pages('user',userPages);await pages('executive',['tasks']);
  await as('executive');assert(!(await state()).permissions.includes('submission.review'));
  await denied(()=>command('transition_task',{id:ownTask,status:'accepted',expectedVersion:1,criterionResults:[true]}),'PAGE_ACCESS_DENIED');
  await as('admin');await pages('executive',['dashboard','meetings','resolutions','tasks','reviews','changes','reports','team','notifications']);
 });
 await check('dashboard-only and reports-only return real bounded summaries without hidden details or unrelated people',async()=>{
  const taskKeys=['id','code','title','resolutionId','ownerId','unit','status','progress','dueDate','originalDueDate','acceptedAt','submittedAt'];
  const resolutionKeys=['id','code','title','status','type','coordinatorId','dueDate','createdAt','meetingId','executionAuthorized','partialContext'];
  const meetingKeys=['id','title','number','date','time','location','committee','status'];
  const userKeys=['id','name','initials','avatarColor','unit','role','roles','accessRole'];
  for(const [name,page] of [['user','dashboard'],['executive','reports']]) {
   await as('admin');await pages(name,[page]);await as(name);const s=await state();
   assert.deepEqual(s.access.pages,[page]);assert.deepEqual(s.state.tasks.map(t=>t.id).sort(),[ownTask,siblingTask].sort());
   assert.equal(s.state.resolutions.length,1);assert.equal(s.state.resolutions[0].id,resolution);assert.equal(s.state.meetings.length,1);assert.equal(s.state.meetings[0].id,meeting);
   assert.equal(s.state.tasks.find(t=>t.id===ownTask).title,'Own task');assert.equal(s.state.tasks.find(t=>t.id===ownTask).progress,0);
   for(const t of s.state.tasks) {assert(Object.keys(t).every(k=>taskKeys.includes(k)));assert(!('description' in t));assert(!('evidence' in t));assert(!('updates' in t));assert(!('criteria' in t));assert(!('reviewerId' in t));}
   for(const r of s.state.resolutions) {assert(Object.keys(r).every(k=>resolutionKeys.includes(k)));assert.equal(r.partialContext,true);assert(!('content' in r));assert(!('closureCriteria' in r));}
   for(const m of s.state.meetings) {assert.deepEqual(Object.keys(m).sort(),meetingKeys.sort());assert(!('agenda' in m));}
   const neededPeople=new Set([people[name],people.user,people.staff,people.staff2]);assert.deepEqual(s.users.map(p=>p.id).sort(),[...neededPeople].sort());
   for(const person of s.users) assert.deepEqual(Object.keys(person).sort(),userKeys.sort());
   assert(!s.users.some(p=>p.id===people.reviewer||p.id===people.empty||p.id===people.admin));
   assert.deepEqual(s.state.changes,[]);assert.deepEqual(s.state.audit,[]);assert.deepEqual(s.state.settings,{});
   await denied(()=>command('add_meeting',{title:'Hidden meeting mutation'}),'PAGE_ACCESS_DENIED');
   await denied(()=>command('add_task',{resolutionId:resolution,title:'Hidden task mutation'}),'PAGE_ACCESS_DENIED');
   await denied(()=>command('update_progress',{id:ownTask,expectedVersion:1,progress:10,note:'Hidden task mutation'}),'PAGE_ACCESS_DENIED');
  }
  await as('admin');await pages('user',userPages);await pages('executive',['dashboard','meetings','resolutions','tasks','reviews','changes','reports','team','notifications']);
  await pages('staff',['dashboard']);await as('staff');const s=await state();
  assert.deepEqual(s.state.tasks.map(t=>t.id),[ownTask]);assert(!('description' in s.state.tasks[0]));assert.deepEqual(s.users.map(p=>p.id),[people.staff]);
  assert.deepEqual(s.state.meetings,[]);assert.deepEqual(s.state.changes,[]);assert.deepEqual(Object.keys(s.state.resolutions[0]).sort(),['code','executionAuthorized','id','partialContext','status','title']);
  await denied(()=>command('acknowledge_task',{id:ownTask,expectedVersion:1}),'PAGE_ACCESS_DENIED');
  await as('admin');await pages('staff',['tasks','changes','notifications']);
 });
 await check('changes-only has bounded versioned task context and can request changes within authorized scope',async()=>{
  await as('admin');await pages('user',['changes']);await as('user');const userState=await state();
  assert.equal(userState.state.tasks.length,2);assert(userState.state.tasks.every(t=>t.rowVersion===1&&!('description' in t)&&!('evidence' in t)&&!('reviewerId' in t)));
  assert.deepEqual(userState.state.meetings,[]);assert(userState.state.resolutions.every(r=>r.partialContext&&!('content' in r)));
  const requested=(await command('create_change_request',{taskId:siblingTask,type:'scope',proposedValue:'Requested change',reason:'Changes page only',expectedVersion:userState.state.tasks.find(t=>t.id===siblingTask).rowVersion})).id;
  assert((await state()).state.changes.some(c=>c.id===requested));
  await denied(()=>command('update_progress',{id:ownTask,expectedVersion:1,progress:10,note:'No task page'}),'PAGE_ACCESS_DENIED');
  await as('admin');await pages('user',userPages);await pages('staff',['changes']);
  await command('decide_change',{id:ownChange,expectedVersion:1,approved:false,reason:'Clear pending fixture before a new request'});
  await as('staff');const staffState=await state();assert.deepEqual(staffState.state.tasks.map(t=>t.id),[ownTask]);assert.equal(staffState.state.tasks[0].rowVersion,1);
  assert.deepEqual(staffState.users.map(p=>p.id),[people.staff]);assert.deepEqual(staffState.eligibleOwners,[]);assert(!JSON.stringify(staffState).includes('Other task secret'));
  const ownRequested=(await command('create_change_request',{taskId:ownTask,type:'deadline',proposedValue:'2026-12-04',reason:'Staff changes only',expectedVersion:staffState.state.tasks[0].rowVersion})).id;
  assert((await state()).state.changes.some(c=>c.id===ownRequested));
  await denied(()=>command('create_change_request',{taskId:siblingTask,type:'deadline',proposedValue:'2026-12-05',reason:'Other task forbidden',expectedVersion:1}),'NOT_FOUND');
  await as('admin');await pages('staff',['tasks','changes','notifications']);
 });
 await check('resolutions-only supplies minimal meeting and assignment selectors and can draft a resolution',async()=>{
  await as('admin');await pages('user',['resolutions']);await as('user');const s=await state();
  assert(s.permissions.includes('task.assign'));assert(!s.access.pages.includes('team'));
  for(const id of [people.staff,people.staff2,people.executive]) assert(s.users.some(p=>p.id===id));
  for(const id of [people.suspended,people.disabled,people.banned]) assert(!s.users.some(p=>p.id===id));
  // A granted override makes the formerly empty member eligible; this is necessary
  // action context, not access to their tasks or an unrestricted team directory.
  assert(s.users.every(p=>Object.keys(p).every(k=>['id','name','initials','avatarColor','unit','role','roles','accessRole'].includes(k))));
  assert.deepEqual(s.state.tasks,[]);assert.deepEqual(s.state.audit,[]);
  assert.equal(s.state.meetings.length,1);assert.equal(s.state.meetings[0].id,meeting);
  for(const source of s.state.meetings) assert.deepEqual(Object.keys(source).sort(),['id','number','title']);
  const drafted=(await command('add_resolution',{title:'Draft with meeting selector',content:'Draft content',meetingId:s.state.meetings[0].id,agenda:'2',type:'action',unit:'Office',coordinatorId:people.user,closureCriteria:['Checked result']})).id;
  assert((await state()).state.resolutions.some(r=>r.id===drafted));
  await denied(()=>command('add_meeting',{title:'Meeting page is still disabled'}),'PAGE_ACCESS_DENIED');
  await as('admin');await pages('user',userPages);
 });
 await check('admin page set is immutable and staff cannot exceed its own-data page boundary',async()=>{
  await as('admin');await denied(()=>pages('admin',[]),'ADMIN_PAGES_IMMUTABLE');
  await denied(()=>pages('staff',['tasks','team']),'INVALID_PAGES');await denied(()=>pages('user',['unknown']),'INVALID_PAGES');
  await denied(()=>pages('user',['tasks','tasks']),'INVALID_PAGES');
  await denied(()=>pages('user',['tasks',null]),'INVALID_PAGES');
 });
 await check('last active admin cannot demote itself and suspended admins do not count',async()=>{
  await as('admin');await denied(()=>assign('admin','staff'),'LAST_ADMIN_REQUIRED');
  await root();await query("insert into private.member_access_roles(organization_id,profile_id,role) values($1,$2,'admin')",[org,people.suspended]);
  await as('admin');await denied(()=>assign('admin','user'),'LAST_ADMIN_REQUIRED');
 });
 await check('serialized competing demotions leave one active admin and recheck actor authorization',async()=>{
  await as('admin');await assign('user','admin');const s=await state();
  await root();
  async function demote(name) {
   return db.transaction(async tx=>{
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[actors[name]]);
    await tx.exec('set local role authenticated');
    return tx.query('select public.workspace_command($1,$2,$3::jsonb,$4)',[org,'set_member_role',JSON.stringify({profileId:people[name],role:'user',expectedVersion:s.access.members[people[name]].version}),randomUUID()]);
   });
  }
  const results=await Promise.allSettled([demote('admin'),demote('user')]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert(results.find(r=>r.status==='rejected').reason.message.includes('LAST_ADMIN_REQUIRED'));
  assert.equal((await query("select count(*)::int n from private.member_access_roles where organization_id=$1 and role='admin' and private.active_member($1,profile_id)",[org])).rows[0].n,1);
  const definition=(await query("select pg_get_functiondef('public.workspace_command(uuid,text,jsonb,uuid)'::regprocedure) definition")).rows[0].definition;
  assert(definition.indexOf('for update')<definition.indexOf('actor:=private.current_profile()'));
  await query('select private.bootstrap_admin($1,$2)',['admin@example.test',org]);await as('admin');await assign('user','user');
 });
 await check('admin does not bypass request self-approval or assigned reviewer guards',async()=>{
  await as('admin');const request=(await command('create_change_request',{taskId:ownTask,type:'owner',proposedValue:people.staff2,reason:'Admin request',expectedVersion:1})).id;
  await denied(()=>command('decide_change',{id:request,expectedVersion:1,approved:true,reason:'Cannot self approve'}),'FORBIDDEN');
  await denied(()=>command('transition_task',{id:ownTask,status:'accepted',expectedVersion:1,criterionResults:[true]}),'FORBIDDEN');
  await assign('executive','admin');
  await as('staff');await command('acknowledge_task',{id:ownTask,expectedVersion:1});
  await command('transition_task',{id:ownTask,status:'in_progress',expectedVersion:2});
  await command('add_evidence',{id:ownTask,expectedVersion:3,evidence:{kind:'link',name:'Output',url:'https://example.test/output'}});
  await command('transition_task',{id:ownTask,status:'submitted',expectedVersion:4});
  await root();await query("insert into public.cycle_participation_events(organization_id,task_cycle_id,profile_id,participation_kind) values($1,$2,$3,'output_contributor')",[org,ownTask,people.executive]);
  await as('executive');assert.equal((await state()).access.role,'admin');
  await denied(()=>command('transition_task',{id:ownTask,status:'accepted',expectedVersion:5,criterionResults:[true]}),'SELF_REVIEW_NOT_ALLOWED');
 });
 await check('upgrade artifact exactly matches migration and bootstrap contains placeholders only',async()=>{
  assert.equal(await readFile(new URL('../upgrade-role-access.sql',import.meta.url),'utf8'),migration);
  const setup=await readFile(new URL('../setup-admin.sql',import.meta.url),'utf8');
  assert(setup.includes('YOUR_LOGIN_EMAIL'));assert(setup.includes('YOUR_ORGANIZATION_UUID'));assert(!setup.includes('bootstrap_workspace'));
  await root();const result=await db.exec(setup.replace('YOUR_LOGIN_EMAIL', 'admin@example.test').replace('YOUR_ORGANIZATION_UUID',org)
   .replace("'YOUR_LOGIN_EMAIL'", "'admin@example.test'").replace("'YOUR_ORGANIZATION_UUID'", `'${org}'`));
  const access=result.find(r=>r.rows[0]?.access_role)?.rows[0];assert.equal(access.access_role,'admin');assert.equal(access.organization_id,org);assert.deepEqual(access.allowed_pages,allPages);
 });
 console.log(`\n${checks} role-access checks passed. PGlite serializes transactions; real PostgreSQL lock contention and hosted Auth require deployment smoke tests.`);
} catch(error) { console.error(error.message,error.where??'');process.exitCode=1; }
finally { await db.close(); }
