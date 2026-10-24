/** Execute real migrations and RPCs in an isolated PostgreSQL WASM instance. No remote project or API key. */
import { PGlite } from '@electric-sql/pglite';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';

const db = new PGlite();
const migrations = fileURLToPath(new URL('../migrations/', import.meta.url));
let checks = 0;
const query = (sql, params = []) => db.query(sql, params);
async function admin() { await db.exec('reset role'); await query("select set_config('request.jwt.claim.sub','',false)"); }
async function as(user) { await admin(); await query("select set_config('request.jwt.claim.sub',$1,false)",[user]); await db.exec('set role authenticated'); }
async function snapshot(org) { return (await query('select public.get_workspace_state($1) as data',[org])).rows[0].data; }
async function command(org, operation, payload, key = randomUUID()) { return (await query('select public.workspace_command($1,$2,$3::jsonb,$4) as data',[org,operation,JSON.stringify(payload),key])).rows[0].data; }
async function rejects(fn, message) { await assert.rejects(fn, error => error.message.includes(message), `Expected ${message}`); }
async function check(name, fn) { await fn(); checks++; console.log(`PASS ${name}`); }
const actors = Object.fromEntries(['secretary','owner','owner2','reviewer','executive','outsider','unprovisioned'].map(x=>[x,randomUUID()]));
let org, otherOrg, people = {}, meetingId, resolutionId, taskId, secondResolution, secondTask;

try {
 await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
 create schema auth; create table auth.users(id uuid primary key,email text);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
 for (const name of (await readdir(migrations)).filter(x=>x.endsWith('.sql')).sort()) {
  await db.exec(await readFile(new URL(`../migrations/${name}`,import.meta.url),'utf8'));
  console.log(`MIGRATED ${name}`);
 }
 for(const [name,id] of Object.entries(actors)) await query('insert into auth.users(id,email) values($1,$2)',[id,`${name}@example.test`]);
 org=(await query("select private.bootstrap_workspace($1,'Test organization','Secretary','สำนักงาน',array['secretary']) as id",[actors.secretary])).rows[0].id;
 for(const role of ['owner','owner2','reviewer','executive']) {
  people[role]=(await query('select private.provision_member($1,$2,$3,$4,$5::text[]) as id',[org,actors[role],role,'สำนักงาน',[role==='owner2'?'owner':role]])).rows[0].id;
 }
 people.secretary=(await query('select profile_id from public.auth_identities where auth_user_id=$1',[actors.secretary])).rows[0].profile_id;
 otherOrg=(await query("select private.bootstrap_workspace($1,'Other organization','Outsider','Other unit',array['secretary']) as id",[actors.outsider])).rows[0].id;
 await check('signup alone does not grant membership',async()=>{await as(actors.unprovisioned);await rejects(()=>snapshot(org),'NO_MEMBERSHIP');});
 await check('cross-organization RPC read denied',async()=>{await as(actors.outsider);await rejects(()=>snapshot(org),'NO_MEMBERSHIP');});
 await check('direct tables and private provisioning are not callable',async()=>{await as(actors.secretary);await rejects(()=>query('select * from public.task_cycles'),'permission denied');await rejects(()=>query('select private.bootstrap_workspace($1,$2,$3,$4)',[actors.secretary,'x','x','x']),'permission denied');});
 await check('workspace starts empty with real organization directory',async()=>{await as(actors.secretary);const s=await snapshot(org);assert.equal(s.state.tasks.length,0);assert.deepEqual(s.roles,['secretary']);assert.equal(s.users.length,5);assert.deepEqual(s.units,['สำนักงาน']);assert(!s.permissions.includes('execution.authorize'));});
 await check('meeting and resolution persist as normalized records',async()=>{
  await as(actors.secretary);
  meetingId=(await command(org,'add_meeting',{title:'Meeting test',committee:'คณะกรรมการทดสอบ',number:'1/2569',date:'2026-11-01',time:'09:00',location:'ห้องประชุม',status:'scheduled',agenda:[]})).id;
  resolutionId=(await command(org,'add_resolution',{title:'Resolution test',content:'A verifiable resolution',meetingId,agenda:'4.1',type:'action',unit:'สำนักงาน',coordinatorId:people.secretary,closureCriteria:['All work verified'],dueDate:'2026-12-31'})).id;
  const s=await snapshot(org);assert.equal(s.state.meetings[0].agenda[0].resolutionIds[0],resolutionId);assert.equal(s.state.resolutions[0].executionAuthorized,false);
 });
 const taskInput=()=>({resolutionId,title:'Task one',description:'Complete work',deliverable:'Verified output',ownerId:people.owner,reviewerId:people.reviewer,unit:'สำนักงาน',priority:'high',dueDate:'2026-12-15',originalDueDate:'2026-12-15',required:true,criteria:['Criterion A','Criterion B']});
 await check('publishing requires explicit execution authority',async()=>{await as(actors.secretary);await rejects(()=>command(org,'add_task',taskInput()),'AUTHORIZATION_REQUIRED');await rejects(()=>command(org,'authorize_resolution',{id:resolutionId,expectedVersion:1,reason:'start'}),'FORBIDDEN');});
 await check('authority is distinct and tasks publish with complete facts',async()=>{await as(actors.executive);await command(org,'authorize_resolution',{id:resolutionId,expectedVersion:1,reason:'Approved authority'});await as(actors.secretary);taskId=(await command(org,'add_task',taskInput())).id;const s=await snapshot(org);assert.equal(s.state.tasks[0].status,'assigned');assert.equal(s.state.tasks[0].rowVersion,1);assert(s.state.tasks[0].stableId!==taskId);});
 await check('owners see only assigned tasks and minimal parent context',async()=>{await as(actors.owner2);assert.equal((await snapshot(org)).state.tasks.length,0);await as(actors.owner);const s=await snapshot(org);assert.equal(s.state.tasks.length,1);assert.equal(s.state.resolutions[0].partialContext,true);assert.notEqual(s.state.resolutions[0].content,'A verifiable resolution');});
 await check('owner transfer picker exposes only minimal eligible same-organization candidates',async()=>{
  await as(actors.owner);const s=await snapshot(org);assert(s.eligibleOwners.some(p=>p.id===people.owner2));assert(!s.users.some(p=>p.id===people.owner2));
  assert.deepEqual(s.eligibleOwners.map(p=>p.id).sort(),[people.owner,people.owner2].sort());
  for(const candidate of s.eligibleOwners) assert.deepEqual(Object.keys(candidate).sort(),['id','name','unit']);
  await as(actors.reviewer);assert.deepEqual((await snapshot(org)).eligibleOwners,[]);
 });
 await check('partial parent visibility does not expose resolution authorization audit text',async()=>{
  await as(actors.secretary);const full=await snapshot(org);assert(full.state.audit.some(e=>e.targetId===resolutionId&&e.detail==='Approved authority'));
  await as(actors.owner);const partial=await snapshot(org);assert(!partial.state.audit.some(e=>e.targetId===resolutionId));
  assert(!partial.state.audit.some(e=>e.detail.includes('Approved authority')));assert(partial.state.audit.some(e=>e.targetId===taskId));
 });
 await check('start requires acknowledgment and rejects wrong owner',async()=>{await as(actors.owner2);await rejects(()=>command(org,'acknowledge_task',{id:taskId,expectedVersion:1}),'NOT_FOUND');await as(actors.owner);await rejects(()=>command(org,'transition_task',{id:taskId,status:'in_progress',expectedVersion:1}),'ACKNOWLEDGMENT_REQUIRED');});
 await check('idempotent acknowledgment retries do not create extra writes',async()=>{await as(actors.owner);const key=randomUUID(),payload={id:taskId,expectedVersion:1};const first=await command(org,'acknowledge_task',payload,key);assert.deepEqual(await command(org,'acknowledge_task',payload,key),first);assert.equal((await snapshot(org)).state.tasks[0].rowVersion,2);await rejects(()=>command(org,'acknowledge_task',{...payload,expectedVersion:2},key),'IDEMPOTENCY_CONFLICT');});
 await check('stale writes fail; progress 100 does not accept work',async()=>{await as(actors.owner);await rejects(()=>command(org,'transition_task',{id:taskId,status:'in_progress',expectedVersion:1}),'STALE_VERSION');await command(org,'transition_task',{id:taskId,status:'in_progress',expectedVersion:2});await command(org,'update_progress',{id:taskId,expectedVersion:3,progress:100,note:'Completed draft'});assert.equal((await snapshot(org)).state.tasks[0].status,'in_progress');});
 await check('submission needs evidence and files remain gated',async()=>{await as(actors.owner);await rejects(()=>command(org,'transition_task',{id:taskId,status:'submitted',expectedVersion:4}),'MISSING_EVIDENCE');await rejects(()=>command(org,'add_evidence',{id:taskId,expectedVersion:4,evidence:{kind:'file',name:'test.pdf',url:'blob:test'}}),'FILE_UPLOAD_NOT_AVAILABLE');await command(org,'add_evidence',{id:taskId,expectedVersion:4,evidence:{kind:'link',name:'Deliverable v1',url:'https://example.test/output-v1'}});});
 await check('frozen submission and return/resubmit retain separate attempts',async()=>{
  await as(actors.owner);await command(org,'transition_task',{id:taskId,status:'submitted',expectedVersion:5,note:'Please review'});
  await rejects(()=>command(org,'add_evidence',{id:taskId,expectedVersion:6,evidence:{kind:'link',name:'Changed',url:'https://example.test/changed'}}),'INVALID_TRANSITION');
  await as(actors.reviewer);await command(org,'transition_task',{id:taskId,status:'revision',expectedVersion:6,note:'Add supporting detail',criterionResults:[true,false]});
  await as(actors.owner);await command(org,'add_evidence',{id:taskId,expectedVersion:7,evidence:{kind:'link',name:'Deliverable v2',url:'https://example.test/output-v2'}});
  await command(org,'transition_task',{id:taskId,status:'submitted',expectedVersion:8,note:'Revised'});
  await admin();const subs=(await query('select s.id,s.attempt_no,count(e.id)::int evidence_count from public.submissions s join public.submission_evidence e on e.submission_id=s.id group by s.id order by s.attempt_no')).rows;
  assert.equal(subs.length,2);assert.equal(subs[0].evidence_count,1);assert.equal(subs[1].evidence_count,2);
 });
 await check('reviewer approval validates all criteria and does not close parent automatically',async()=>{await as(actors.reviewer);await rejects(()=>command(org,'transition_task',{id:taskId,status:'accepted',expectedVersion:9,note:'Incomplete checks',criterionResults:[true,false]}),'MISSING_CRITERIA');await rejects(()=>command(org,'transition_task',{id:taskId,status:'accepted',expectedVersion:9,note:'Missing array'}),'INVALID_CRITERION_RESULTS');await command(org,'transition_task',{id:taskId,status:'accepted',expectedVersion:9,note:'Both criteria passed',criterionResults:[true,true]});const s=await snapshot(org);assert.equal(s.state.tasks[0].status,'accepted');assert.equal(s.state.resolutions[0].status,'pending_close');await admin();assert.equal((await query("select count(*)::int n from public.review_criterion_results where result='passed'")).rows[0].n,3);assert.equal((await query("select count(*)::int n from public.review_criterion_results where result='failed'")).rows[0].n,1);});
 await check('confirmed evidence/reviews/audit reject modification even by application owner paths',async()=>{await admin();await rejects(()=>query("update public.reviews set summary='tampered'"),'IMMUTABLE_RECORD');await rejects(()=>query("update private.audit_events set detail='tampered'"),'IMMUTABLE_RECORD');await rejects(()=>query("update public.submissions set statement='tampered'"),'IMMUTABLE_SUBMISSION');});
 await check('closure is an explicit separate authorized action',async()=>{await as(actors.executive);const s=await snapshot(org),r=s.state.resolutions[0];await rejects(()=>command(org,'close_resolution',{id:resolutionId,expectedVersion:r.rowVersion,criteriaConfirmed:false}),'MISSING_CRITERIA');await command(org,'close_resolution',{id:resolutionId,expectedVersion:r.rowVersion,criteriaConfirmed:true,reason:'Closure verified'});assert.equal((await snapshot(org)).state.resolutions[0].status,'closed');});
 await check('closed resolution rejects newly assigned work',async()=>{await as(actors.secretary);await rejects(()=>command(org,'add_task',taskInput()),'INVALID_RESOLUTION');});
 await check('prepare independent change-request workflow',async()=>{
  await as(actors.secretary);secondResolution=(await command(org,'add_resolution',{title:'Changes',content:'Changes workflow',meetingId,agenda:'4.2',type:'action',unit:'สำนักงาน',coordinatorId:people.secretary,closureCriteria:['Verify changes']})).id;
  await as(actors.executive);await command(org,'authorize_resolution',{id:secondResolution,expectedVersion:1,reason:'start'});
  await as(actors.secretary);secondTask=(await command(org,'add_task',{...taskInput(),resolutionId:secondResolution,title:'Changeable task'})).id;
 });
 const taskTwo=async()=> (await snapshot(org)).state.tasks.find(t=>t.id===secondTask);
 await check('pending deadline request has no effect; approval preserves original baseline',async()=>{
  await as(actors.owner);const request=(await command(org,'create_change_request',{taskId:secondTask,type:'deadline',proposedValue:'2027-01-15',reason:'External dependency',expectedVersion:1})).id;
  assert.equal((await taskTwo()).dueDate,'2026-12-15');
  await as(actors.executive);await command(org,'decide_change',{id:request,approved:true,reason:'Extension approved',expectedVersion:1});
  const t=await taskTwo();assert.equal(t.dueDate,'2027-01-15');assert.equal(t.originalDueDate,'2026-12-15');assert.equal(t.rowVersion,2);
 });
 await check('scope approval creates a new immutable spec and copies criteria',async()=>{
  await as(actors.owner);const request=(await command(org,'create_change_request',{taskId:secondTask,type:'scope',proposedValue:'Updated scope description',reason:'Clarify scope',expectedVersion:2})).id;
  await as(actors.executive);await command(org,'decide_change',{id:request,approved:true,reason:'Scope approved',expectedVersion:1});
  const t=await taskTwo();assert.equal(t.description,'Updated scope description');assert.equal(t.criteria.length,2);assert.equal(t.rowVersion,3);
  await admin();const rows=(await query('select description from public.task_spec_versions where task_cycle_id=$1 order by version_no',[secondTask])).rows;assert.equal(rows.length,2);assert.equal(rows[0].description,'Complete work');
 });
 await check('owner transfer preserves progress and deadlines but requires fresh acknowledgment',async()=>{
  await as(actors.owner);await command(org,'acknowledge_task',{id:secondTask,expectedVersion:3});await command(org,'transition_task',{id:secondTask,status:'in_progress',expectedVersion:4});await command(org,'update_progress',{id:secondTask,expectedVersion:5,progress:35,note:'Work before handover'});
  const request=(await command(org,'create_change_request',{taskId:secondTask,type:'owner',proposedValue:people.owner2,reason:'Handover',expectedVersion:6})).id;
  await as(actors.executive);await command(org,'decide_change',{id:request,approved:true,reason:'Owner approved',expectedVersion:1});
  const t=await taskTwo();assert.equal(t.ownerId,people.owner2);assert.equal(t.progress,35);assert.equal(t.status,'assigned');assert.equal(t.acknowledgedAt,undefined);assert.equal(t.dueDate,'2027-01-15');assert.equal(t.originalDueDate,'2026-12-15');
  await as(actors.owner);assert(!(await snapshot(org)).state.tasks.some(t=>t.id===secondTask));
 });
 await check('conflicting approved deadline proposal fails stale and can be explicitly rejected',async()=>{
  await as(actors.owner2);const request=(await command(org,'create_change_request',{taskId:secondTask,type:'deadline',proposedValue:'2027-02-15',reason:'New extension',expectedVersion:7})).id;
  await admin();await query("insert into public.task_deadline_versions(organization_id,task_cycle_id,version_no,due_on,approved_by,reason) values($1,$2,3,'2027-01-20',$3,'Fixture simulates another approved decision')",[org,secondTask,people.executive]);
  await query('update public.task_cycles set current_deadline_version_id=(select id from public.task_deadline_versions where task_cycle_id=$1 and version_no=3),row_version=row_version+1 where id=$1',[secondTask]);
  await as(actors.executive);await rejects(()=>command(org,'decide_change',{id:request,approved:true,reason:'stale attempt',expectedVersion:1}),'STALE_VERSION');
  assert.equal((await snapshot(org)).state.changes.find(c=>c.id===request).status,'pending');
  await command(org,'decide_change',{id:request,approved:false,reason:'Reapply against new deadline',expectedVersion:1});
  assert.equal((await snapshot(org)).state.changes.find(c=>c.id===request).status,'rejected');
 });
 await check('previous output contributor cannot review after assignment changes',async()=>{
  await as(actors.owner2);await command(org,'acknowledge_task',{id:secondTask,expectedVersion:8});await command(org,'transition_task',{id:secondTask,status:'in_progress',expectedVersion:9});
  await command(org,'add_evidence',{id:secondTask,expectedVersion:10,evidence:{kind:'link',name:'Output','url':'https://example.test/output'}});await command(org,'transition_task',{id:secondTask,status:'submitted',expectedVersion:11});
  await admin();await query("insert into public.cycle_participation_events(organization_id,task_cycle_id,profile_id,participation_kind) values($1,$2,$3,'output_contributor')",[org,secondTask,people.reviewer]);
  await as(actors.reviewer);await rejects(()=>command(org,'transition_task',{id:secondTask,status:'accepted',expectedVersion:12,criterionResults:[true,true]}),'SELF_REVIEW_NOT_ALLOWED');
 });
 await check('policy changes are versioned and unavailable email integration cannot be enabled',async()=>{
  await as(actors.secretary);await rejects(()=>command(org,'update_settings',{patch:{emailNotifications:true}}),'EMAIL_NOT_AVAILABLE');await rejects(()=>command(org,'update_settings',{patch:{reviewDays:null}}),'VALIDATION_FAILED');await rejects(()=>command(org,'update_settings',{patch:{reminderDays:[null]}}),'VALIDATION_FAILED');await command(org,'update_settings',{patch:{reviewDays:5}});assert.equal((await snapshot(org)).state.settings.reviewDays,5);
  await admin();assert.equal((await query("select count(*)::int n from public.policy_versions where organization_id=$1 and policy_key='tracking'",[org])).rows[0].n,2);
 });
 await check('notification reads are recipient-scoped and do not acknowledge assignments',async()=>{
  await as(actors.owner2);const s=await snapshot(org);assert(s.state.notifications.length>0);await command(org,'mark_all_read',{});assert((await snapshot(org)).state.notifications.every(n=>n.read));
  const id=s.state.notifications[0].id;await as(actors.owner);await rejects(()=>command(org,'mark_notification_read',{id}),'NOT_FOUND');
 });
 await check('revoked member is denied despite still-valid identity claim',async()=>{await admin();await query('select private.revoke_member($1,$2,$3)',[org,people.owner,'test revoke']);await as(actors.owner);await rejects(()=>snapshot(org),'NO_MEMBERSHIP');await rejects(()=>command(org,'mark_all_read',{}),'FORBIDDEN');});
 await check('disabled identity is denied even while JWT claim remains set',async()=>{await admin();await query('select private.disable_identity($1,$2)',[actors.secretary,'test disable']);await as(actors.secretary);await rejects(()=>snapshot(org),'NO_MEMBERSHIP');});
 await check('tenant foreign keys reject cross-organization relationships',async()=>{await admin();await rejects(()=>query('insert into public.agenda_items(organization_id,meeting_id,agenda_no,title) values($1,$2,$3,$4)',[otherOrg,meetingId,'cross','invalid']),'foreign key');});
 console.log(`\n${checks} database integration checks passed. Auth tables are local test stubs; hosted Auth/Storage and multi-session concurrency still require deployment smoke tests.`);
} catch(error) {
 console.error(error);
 process.exitCode=1;
} finally { await db.close(); }
