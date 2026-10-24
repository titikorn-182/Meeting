begin;
create function public.workspace_command(p_organization_id uuid,p_operation text,p_payload jsonb,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid; org uuid:=p_organization_id; permission_needed text; target uuid; parent uuid; result jsonb; prior jsonb;
 t public.task_cycles%rowtype; r public.resolution_cycles%rowtype; cr public.change_requests%rowtype;
 spec public.task_spec_versions%rowtype; own public.owner_assignments%rowtype; reviewer public.reviewer_assignments%rowtype;
 sub public.submissions%rowtype; prev_deadline public.task_deadline_versions%rowtype;
 new_id uuid; new_version uuid; new_task uuid; new_owner uuid; new_reviewer uuid; unit uuid; agenda uuid; term uuid; committee uuid;
 auth_event uuid; link_id uuid; decision_id uuid; original_version uuid; requested_version bigint;
 ordinal integer; item text; note text; new_description text; code text; new_status text; due date; flag boolean; config jsonb;
 before_json jsonb; hash text; old_hash text;
begin
 if p_idempotency_key is null or p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>65536 then
  raise exception using errcode='22023',message='VALIDATION_FAILED';
 end if;
 -- Shared locks are held through commit. Authorization is read in a separate statement after locks.
 perform 1 from private.identity_authorization_guard where id=1 for share;
 perform 1 from private.authorization_guards where organization_id=org for share;
 actor:=private.current_profile();
 if actor is null then raise exception using errcode='42501',message='UNAUTHENTICATED'; end if;
 if not private.active_member(org,actor) then raise exception using errcode='42501',message='FORBIDDEN'; end if;
 permission_needed:=case p_operation
 when 'add_meeting' then 'meeting.manage' when 'add_resolution' then 'resolution.draft'
 when 'authorize_resolution' then 'execution.authorize' when 'add_task' then 'task.assign'
 when 'acknowledge_task' then 'task.work' when 'update_progress' then 'task.work' when 'add_evidence' then 'task.work'
 when 'transition_task' then case when p_payload->>'status' in ('accepted','revision') then 'submission.review' else 'task.work' end
 when 'create_change_request' then 'change.request' when 'decide_change' then '__change__'
 when 'close_resolution' then 'resolution.close' when 'update_settings' then 'policy.manage'
 when 'mark_notification_read' then '' when 'mark_all_read' then '' else null end;
 if permission_needed is null then raise exception using errcode='22023',message='UNKNOWN_OPERATION'; end if;
 if permission_needed='__change__' then
  select case request_type when 'deadline' then 'deadline.approve' when 'owner' then 'assignment.approve' else 'scope.approve' end
   into permission_needed from public.change_requests where organization_id=org and id=(p_payload->>'id')::uuid;
  if permission_needed is null then raise exception using errcode='22023',message='NOT_FOUND'; end if;
 end if;
 if permission_needed<>'' then perform private.require_permission(org,actor,permission_needed); end if;
 hash:=md5(p_payload::text);
 insert into private.request_deduplications(organization_id,actor_id,operation,idempotency_key,request_hash)
 values(org,actor,p_operation,p_idempotency_key,hash) on conflict do nothing;
 select request_hash,response into old_hash,prior from private.request_deduplications
 where organization_id=org and actor_id=actor and operation=p_operation and idempotency_key=p_idempotency_key for update;
 if old_hash<>hash then raise exception using errcode='22023',message='IDEMPOTENCY_CONFLICT'; end if;
 if prior is not null then return prior; end if;
 target:=nullif(p_payload->>'id','')::uuid;
 note:=btrim(coalesce(p_payload->>'note',p_payload->>'reason',''));

 if p_operation='add_meeting' then
  if length(btrim(coalesce(p_payload->>'title','')))=0 or length(btrim(coalesce(p_payload->>'number','')))=0
   or coalesce(p_payload->>'date','')!~'^\d{4}-\d{2}-\d{2}$' or coalesce(p_payload->>'time','09:00')!~'^\d{2}:\d{2}$' then
   raise exception using errcode='22023',message='VALIDATION_FAILED'; end if;
  select c.id into committee from public.committees c where c.organization_id=org and c.name_th=p_payload->>'committee';
  if length(btrim(coalesce(p_payload->>'committee','')))=0 then raise exception using errcode='22023',message='INVALID_COMMITTEE'; end if;
  if committee is null then
   insert into public.committees(organization_id,code,name_th) values(org,'committee-'||gen_random_uuid()::text,btrim(p_payload->>'committee'))
    on conflict(organization_id,name_th) do update set name_th=excluded.name_th returning id into committee;
   insert into public.committee_terms(organization_id,committee_id,term_code,starts_on) values(org,committee,'initial',current_date) on conflict do nothing;
  end if;
  select ct.id into term from public.committee_terms ct where ct.organization_id=org and ct.committee_id=committee order by starts_on desc,id limit 1;
  insert into public.meetings(organization_id,term_id,meeting_no,title,scheduled_start,location,status,created_by)
  values(org,term,btrim(p_payload->>'number'),btrim(p_payload->>'title'),((p_payload->>'date')||' '||coalesce(p_payload->>'time','09:00'))::timestamp at time zone 'Asia/Bangkok',coalesce(p_payload->>'location',''),coalesce(p_payload->>'status','scheduled'),actor)
  returning id into target;
  if jsonb_typeof(p_payload->'agenda')='array' then
   for config in select value from jsonb_array_elements(p_payload->'agenda') loop
    if length(btrim(coalesce(config->>'number','')))>0 and length(btrim(coalesce(config->>'title','')))>0 then
     insert into public.agenda_items(organization_id,meeting_id,agenda_no,title) values(org,target,btrim(config->>'number'),btrim(config->>'title'));
    end if;
   end loop;
  end if;
  perform private.record_audit(org,actor,'เพิ่มการประชุม','meeting',target,p_payload->>'title',p_payload->>'date',p_idempotency_key);

 elsif p_operation='add_resolution' then
  if length(btrim(coalesce(p_payload->>'title','')))=0 or length(btrim(coalesce(p_payload->>'content','')))=0
    or coalesce(p_payload->>'type','') not in ('action','approval','acknowledgment','recurring') then raise exception using errcode='22023',message='VALIDATION_FAILED'; end if;
  perform 1 from public.meetings where organization_id=org and id=(p_payload->>'meetingId')::uuid for update;
  if not found then raise exception using errcode='22023',message='NOT_FOUND'; end if;
  if length(btrim(coalesce(p_payload->>'agenda','')))=0 then raise exception using errcode='22023',message='VALIDATION_FAILED'; end if;
  unit:=private.unit_id(org,p_payload->>'unit');
  if not private.active_member(org,(p_payload->>'coordinatorId')::uuid) then raise exception using errcode='22023',message='INVALID_ASSIGNEE'; end if;
  if p_payload->>'type'<>'acknowledgment' and (jsonb_typeof(p_payload->'closureCriteria') is distinct from 'array' or jsonb_array_length(p_payload->'closureCriteria')=0) then raise exception using errcode='22023',message='MISSING_CRITERIA'; end if;
  select id into agenda from public.agenda_items where organization_id=org and meeting_id=(p_payload->>'meetingId')::uuid and agenda_no=p_payload->>'agenda';
  if agenda is null then
   insert into public.agenda_items(organization_id,meeting_id,agenda_no,title) values(org,(p_payload->>'meetingId')::uuid,p_payload->>'agenda',p_payload->>'title') returning id into agenda;
  end if;
  code:=private.next_code(org,'resolution');
  insert into public.resolutions(organization_id,code,origin_agenda_id,created_by) values(org,code,agenda,actor) returning id into new_id;
  insert into public.resolution_versions(organization_id,resolution_id,version_no,title,content,resolution_type,lead_unit_id,coordinator_id,due_on,confirmed_by)
  values(org,new_id,1,btrim(p_payload->>'title'),btrim(p_payload->>'content'),p_payload->>'type',unit,(p_payload->>'coordinatorId')::uuid,nullif(p_payload->>'dueDate','')::date,actor) returning id into new_version;
  ordinal:=0;
  for item in select jsonb_array_elements_text(coalesce(p_payload->'closureCriteria','[]'::jsonb)) loop
   ordinal:=ordinal+1; insert into public.resolution_criteria(organization_id,resolution_version_id,position,description) values(org,new_version,ordinal,btrim(item));
  end loop;
  insert into public.resolution_cycles(organization_id,resolution_id,governing_version_id,status)
  values(org,new_id,new_version,case when p_payload->>'type'='acknowledgment' then 'acknowledged' else 'open' end) returning id into target;
  update public.resolutions set current_cycle_id=target where organization_id=org and id=new_id;
  perform private.record_audit(org,actor,'บันทึกมติ','resolution',target,p_payload->>'title','บันทึกทะเบียน ยังต้องอนุญาตเริ่มแยกต่างหาก',p_idempotency_key);

 elsif p_operation in ('authorize_resolution','close_resolution') then
  select * into r from public.resolution_cycles where organization_id=org and id=target for update;
  if not found then raise exception using errcode='22023',message='NOT_FOUND'; end if;
  perform private.assert_version(p_payload->>'expectedVersion',r.row_version);
  if r.status not in ('open','pending_close') then raise exception using errcode='22023',message='INVALID_TRANSITION'; end if;
  if p_operation='authorize_resolution' then
   if length(note)=0 then raise exception using errcode='22023',message='REASON_REQUIRED'; end if;
   if private.execution_authorized(org,target) then raise exception using errcode='22023',message='ALREADY_AUTHORIZED'; end if;
   insert into public.start_authorization_events(organization_id,resolution_cycle_id,decision,reason,actor_id) values(org,target,'authorize',note,actor);
   update public.resolution_cycles set row_version=row_version+1 where organization_id=org and id=target;
   perform private.record_audit(org,actor,'อนุญาตเริ่มดำเนินงาน','resolution',target,'การอนุญาตเริ่ม',note,p_idempotency_key);
  else
   if coalesce((p_payload->>'criteriaConfirmed')::boolean,false) is not true then raise exception using errcode='22023',message='MISSING_CRITERIA'; end if;
   if not private.execution_authorized(org,target) then raise exception using errcode='42501',message='AUTHORIZATION_REQUIRED'; end if;
   if (select resolution_type from public.resolution_versions where organization_id=org and id=r.governing_version_id) not in ('action','approval') then raise exception using errcode='22023',message='INVALID_TRANSITION'; end if;
   perform c.id from public.task_cycles c join public.resolution_cycle_tasks l on l.organization_id=org and l.task_cycle_id=c.id and l.valid_to is null
    where c.organization_id=org and l.resolution_cycle_id=target order by c.id for update of c;
   -- This first slice has no continuation/transfer disposition UI: all linked tasks must be accepted.
   if not exists(select 1 from public.resolution_cycle_tasks where organization_id=org and resolution_cycle_id=target and required_for_closure and valid_to is null)
    or exists(select 1 from public.resolution_cycle_tasks l join public.task_cycles c on c.organization_id=org and c.id=l.task_cycle_id where l.organization_id=org and l.resolution_cycle_id=target and l.valid_to is null and c.status<>'accepted')
    or not exists(select 1 from public.resolution_criteria where organization_id=org and resolution_version_id=r.governing_version_id)
    or exists(select 1 from public.change_requests c join public.resolution_cycle_tasks l on l.organization_id=org and l.task_cycle_id=c.task_cycle_id where c.organization_id=org and l.resolution_cycle_id=target and l.valid_to is null and c.status='pending') then
    raise exception using errcode='22023',message='CLOSURE_NOT_READY'; end if;
   insert into public.closure_requests(organization_id,resolution_cycle_id,governing_version_id,requested_by) values(org,target,r.governing_version_id,actor) returning id into new_id;
   insert into public.closure_task_snapshots(organization_id,closure_request_id,task_cycle_id,accepted_submission_id)
    select org,new_id,c.id,c.accepted_submission_id from public.resolution_cycle_tasks l join public.task_cycles c on c.organization_id=org and c.id=l.task_cycle_id where l.organization_id=org and l.resolution_cycle_id=target and l.valid_to is null;
   insert into public.closure_criterion_results(organization_id,closure_request_id,resolution_criterion_id,result,finding)
    select org,new_id,id,'passed',coalesce(nullif(note,''),'ผู้มีอำนาจยืนยันเกณฑ์ระดับมติครบ') from public.resolution_criteria where organization_id=org and resolution_version_id=r.governing_version_id;
   insert into public.closure_decisions(organization_id,closure_request_id,actor_id,decision,reason) values(org,new_id,actor,'approved',coalesce(nullif(note,''),'ยืนยันเกณฑ์และตรวจรับทุกงานที่ผูกกับรอบมติ'));
   update public.resolution_cycles set status='closed',closed_at=clock_timestamp(),row_version=row_version+1 where organization_id=org and id=target;
   perform private.record_audit(org,actor,'รับรองปิดมติ','resolution',target,'ปิดมติ',coalesce(nullif(note,''),'เกณฑ์ครบและทุกงานผ่านตรวจ'),p_idempotency_key);
  end if;

 elsif p_operation='add_task' then
  parent:=(p_payload->>'resolutionId')::uuid;
  select * into r from public.resolution_cycles where organization_id=org and id=parent for update;
  if not found or r.status not in ('open','pending_close') then raise exception using errcode='22023',message='INVALID_RESOLUTION'; end if;
  if not private.execution_authorized(org,parent) then raise exception using errcode='42501',message='AUTHORIZATION_REQUIRED'; end if;
  if length(btrim(coalesce(p_payload->>'title','')))=0 or length(btrim(coalesce(p_payload->>'description','')))=0
   or length(btrim(coalesce(p_payload->>'deliverable','')))=0 or jsonb_typeof(p_payload->'criteria') is distinct from 'array'
   or jsonb_array_length(p_payload->'criteria')=0 or coalesce(p_payload->>'dueDate','')!~'^\d{4}-\d{2}-\d{2}$' then raise exception using errcode='22023',message='VALIDATION_FAILED'; end if;
  new_owner:=(p_payload->>'ownerId')::uuid; new_reviewer:=(p_payload->>'reviewerId')::uuid;
  if new_owner=new_reviewer or not private.has_permission(org,new_owner,'task.work') or not private.has_permission(org,new_reviewer,'submission.review') then raise exception using errcode='22023',message='INVALID_ASSIGNEE'; end if;
  unit:=private.unit_id(org,p_payload->>'unit'); due:=(p_payload->>'dueDate')::date; code:=private.next_code(org,'task');
  insert into public.tasks(organization_id,code,origin_resolution_id,created_by) values(org,code,r.resolution_id,actor) returning id into new_task;
  insert into public.task_cycles(organization_id,task_id,status) values(org,new_task,'assigned') returning id into target;
  insert into public.task_spec_versions(organization_id,task_cycle_id,version_no,title,description,deliverable,priority,lead_unit_id,confirmed_by,reason)
   values(org,target,1,btrim(p_payload->>'title'),btrim(p_payload->>'description'),btrim(p_payload->>'deliverable'),coalesce(p_payload->>'priority','normal'),unit,actor,'เผยแพร่งานครั้งแรก') returning id into new_version;
  ordinal:=0;
  for item in select jsonb_array_elements_text(p_payload->'criteria') loop ordinal:=ordinal+1;
   insert into public.task_criteria(organization_id,spec_version_id,position,description) values(org,new_version,ordinal,btrim(item)); end loop;
  update public.task_cycles set current_spec_version_id=new_version where organization_id=org and id=target;
  insert into public.task_deadline_versions(organization_id,task_cycle_id,version_no,due_on,approved_by,reason) values(org,target,1,due,actor,'กำหนดแรกที่เผยแพร่') returning id into new_id;
  update public.task_cycles set original_deadline_version_id=new_id,current_deadline_version_id=new_id where organization_id=org and id=target;
  insert into public.owner_assignments(organization_id,task_cycle_id,owner_id,assigned_by,reason) values(org,target,new_owner,actor,'มอบหมายครั้งแรก') returning id into own.id;
  insert into public.reviewer_assignments(organization_id,task_cycle_id,reviewer_id,assigned_by,reason) values(org,target,new_reviewer,actor,'มอบหมายผู้ตรวจครั้งแรก') returning id into reviewer.id;
  insert into public.cycle_participation_events(organization_id,task_cycle_id,profile_id,participation_kind) values(org,target,new_owner,'owner');
  insert into public.resolution_cycle_tasks(organization_id,resolution_cycle_id,task_cycle_id,required_for_closure,approved_by,reason)
   values(org,parent,target,coalesce((p_payload->>'required')::boolean,true),actor,'กำหนดขอบเขตเมื่อเผยแพร่');
  select id into auth_event from public.start_authorization_events where organization_id=org and resolution_cycle_id=parent order by effective_at desc,recorded_at desc,id desc limit 1;
  insert into public.task_publication_facts(organization_id,task_cycle_id,spec_version_id,owner_assignment_id,reviewer_assignment_id,authorization_event_id,completeness_passed)
   values(org,target,new_version,own.id,reviewer.id,auth_event,true);
  update public.tasks set current_cycle_id=target where organization_id=org and id=new_task;
  update public.resolution_cycles set status='open',row_version=row_version+1 where organization_id=org and id=parent;
  perform private.notify_task(org,new_owner,target,'ได้รับมอบหมายงานใหม่',p_payload->>'title','assignment');
  perform private.record_audit(org,actor,'มอบหมายงาน','task',target,p_payload->>'title',p_payload->>'deliverable',p_idempotency_key);

 elsif p_operation in ('acknowledge_task','transition_task','update_progress','add_evidence','create_change_request','decide_change') then
  if p_operation='create_change_request' then target:=(p_payload->>'taskId')::uuid;
  elsif p_operation='decide_change' then
   select * into cr from public.change_requests where organization_id=org and id=target;
   if not found then raise exception using errcode='22023',message='NOT_FOUND'; end if;
   target:=cr.task_cycle_id;
  end if;
  -- Parent first, then task, then subordinate records: all writers follow the same lock order.
  select resolution_cycle_id into parent from public.resolution_cycle_tasks where organization_id=org and task_cycle_id=target and valid_to is null;
  if parent is null or not private.read_task(org,target,actor) then raise exception using errcode='42501',message='NOT_FOUND'; end if;
  select * into r from public.resolution_cycles where organization_id=org and id=parent for update;
  select * into t from public.task_cycles where organization_id=org and id=target for update;
  if p_operation='decide_change' then
   select * into cr from public.change_requests where organization_id=org and id=cr.id for update;
   perform private.assert_version(p_payload->>'expectedVersion',cr.row_version);
  else perform private.assert_version(p_payload->>'expectedVersion',t.row_version); end if;
  select * into spec from public.task_spec_versions where organization_id=org and id=t.current_spec_version_id;
  select * into own from public.owner_assignments where organization_id=org and task_cycle_id=target and valid_to is null;
  select * into reviewer from public.reviewer_assignments where organization_id=org and task_cycle_id=target and valid_to is null;
  select * into prev_deadline from public.task_deadline_versions where organization_id=org and id=t.current_deadline_version_id;
  before_json:=private.task_dto(org,target);

  if p_operation='acknowledge_task' then
   if own.owner_id<>actor then raise exception using errcode='42501',message='FORBIDDEN'; end if;
   if t.status in ('accepted','cancelled') then raise exception using errcode='22023',message='INVALID_TRANSITION'; end if;
   if own.acknowledged_at is null then
    update public.owner_assignments set acknowledged_at=clock_timestamp() where organization_id=org and id=own.id;
    update public.task_cycles set row_version=row_version+1 where organization_id=org and id=target;
   end if;
   perform private.record_audit(org,actor,'รับทราบงาน','task',target,spec.title,'รับทราบการมอบหมาย โดยยังไม่ถือว่าเริ่มดำเนินการ',p_idempotency_key,before_json,private.task_dto(org,target));

  elsif p_operation='update_progress' then
   if own.owner_id<>actor then raise exception using errcode='42501',message='FORBIDDEN'; end if;
   if t.status not in ('in_progress','revision') then raise exception using errcode='22023',message='INVALID_TRANSITION'; end if;
   if length(note)=0 or p_payload->>'progress' is null or (p_payload->>'progress')::numeric not between 0 and 100 then raise exception using errcode='22023',message='VALIDATION_FAILED'; end if;
   insert into public.progress_reports(organization_id,task_cycle_id,author_id) values(org,target,actor) returning id into new_id;
   insert into public.progress_report_versions(organization_id,report_id,progress_percent,work_done) values(org,new_id,(p_payload->>'progress')::numeric,note);
   update public.task_cycles set latest_progress=(p_payload->>'progress')::numeric,row_version=row_version+1 where organization_id=org and id=target;
   perform private.record_audit(org,actor,'รายงานความก้าวหน้า','task',target,spec.title,note,p_idempotency_key,before_json,private.task_dto(org,target));

  elsif p_operation='add_evidence' then
   if own.owner_id<>actor then raise exception using errcode='42501',message='FORBIDDEN'; end if;
   if t.status not in ('assigned','in_progress','revision') then raise exception using errcode='22023',message='INVALID_TRANSITION'; end if;
   config:=p_payload->'evidence';
   if config->>'kind' is distinct from 'link' then raise exception using errcode='0A000',message='FILE_UPLOAD_NOT_AVAILABLE'; end if;
   if length(btrim(coalesce(config->>'name','')))=0 or length(coalesce(config->>'url',''))>2048 or coalesce(config->>'url','')!~'^https?://[^[:space:]]+$' then raise exception using errcode='22023',message='VALIDATION_FAILED'; end if;
   insert into public.documents(organization_id,title,created_by) values(org,btrim(config->>'name'),actor) returning id into new_id;
   insert into public.document_versions(organization_id,document_id,kind,source_url,uploaded_by) values(org,new_id,'link',config->>'url',actor) returning id into new_version;
   insert into public.task_evidence_links(organization_id,task_cycle_id,document_version_id,title,added_by) values(org,target,new_version,btrim(config->>'name'),actor);
   update public.task_cycles set row_version=row_version+1 where organization_id=org and id=target;
   perform private.record_audit(org,actor,'เพิ่มหลักฐานลิงก์','task',target,spec.title,config->>'name',p_idempotency_key);

  elsif p_operation='transition_task' then
   new_status:=p_payload->>'status';
   if r.status not in ('open','pending_close') or not private.execution_authorized(org,parent) then raise exception using errcode='42501',message='AUTHORIZATION_REQUIRED'; end if;
   if new_status='in_progress' then
    if own.owner_id<>actor then raise exception using errcode='42501',message='FORBIDDEN'; end if;
    if t.status<>'assigned' or own.acknowledged_at is null then raise exception using errcode='22023',message='ACKNOWLEDGMENT_REQUIRED'; end if;
    update public.task_cycles set status='in_progress',started_at=coalesce(started_at,clock_timestamp()),row_version=row_version+1 where organization_id=org and id=target;
   elsif new_status='submitted' then
    if own.owner_id<>actor then raise exception using errcode='42501',message='FORBIDDEN'; end if;
    if t.status not in ('in_progress','revision') then raise exception using errcode='22023',message='INVALID_TRANSITION'; end if;
    if not exists(select 1 from public.task_evidence_links where organization_id=org and task_cycle_id=target) then raise exception using errcode='22023',message='MISSING_EVIDENCE'; end if;
    if not private.has_permission(org,reviewer.reviewer_id,'submission.review') then raise exception using errcode='22023',message='INVALID_REVIEWER'; end if;
    select coalesce(max(attempt_no),0)+1 into ordinal from public.submissions where organization_id=org and task_cycle_id=target;
    insert into public.submissions(organization_id,task_cycle_id,attempt_no,spec_version_id,owner_assignment_id,reviewer_assignment_id,submitted_by,statement)
     values(org,target,ordinal,t.current_spec_version_id,own.id,reviewer.id,actor,coalesce(nullif(note,''),'ยืนยันส่งผลงานตามเกณฑ์ที่กำหนด')) returning id into new_id;
    insert into public.submission_evidence(organization_id,submission_id,document_version_id,submitted_title)
     select org,new_id,e.document_version_id,e.title from public.task_evidence_links e where e.organization_id=org and e.task_cycle_id=target;
    update public.task_cycles set status='submitted',row_version=row_version+1 where organization_id=org and id=target;
    perform private.notify_task(org,reviewer.reviewer_id,target,'มีผลงานส่งตรวจใหม่',spec.title,'review');
   elsif new_status in ('accepted','revision') then
    if reviewer.reviewer_id<>actor then raise exception using errcode='42501',message='FORBIDDEN'; end if;
    if t.status<>'submitted' then raise exception using errcode='22023',message='INVALID_TRANSITION'; end if;
    if exists(select 1 from public.cycle_participation_events where organization_id=org and task_cycle_id=target and profile_id=actor and participation_kind in ('owner','output_contributor')) then raise exception using errcode='42501',message='SELF_REVIEW_NOT_ALLOWED'; end if;
    if new_status='revision' and length(note)=0 then raise exception using errcode='22023',message='REASON_REQUIRED'; end if;
    select * into sub from public.submissions where organization_id=org and task_cycle_id=target and status='pending' for update;
    if not found then raise exception using errcode='22023',message='INVALID_TRANSITION'; end if;
    if jsonb_typeof(p_payload->'criterionResults') is distinct from 'array'
     or jsonb_array_length(p_payload->'criterionResults')<>(select count(*) from public.task_criteria where organization_id=org and spec_version_id=sub.spec_version_id)
     or exists(select 1 from jsonb_array_elements(p_payload->'criterionResults') value where jsonb_typeof(value)<>'boolean') then
     raise exception using errcode='22023',message='INVALID_CRITERION_RESULTS'; end if;
    if new_status='accepted' and exists(select 1 from jsonb_array_elements(p_payload->'criterionResults') value where value<>'true'::jsonb) then
     raise exception using errcode='22023',message='MISSING_CRITERIA'; end if;
    insert into public.reviews(organization_id,submission_id,reviewer_id,reviewer_assignment_id,decision,summary)
     values(org,sub.id,actor,reviewer.id,case when new_status='accepted' then 'accepted' else 'returned' end,coalesce(nullif(note,''),'ผู้ตรวจยืนยันทุกเกณฑ์ของชุดส่งผ่าน')) returning id into decision_id;
    insert into public.review_criterion_results(organization_id,review_id,task_criterion_id,result,finding)
     select org,decision_id,id,case when (p_payload->'criterionResults'->>(position-1))::boolean then 'passed' else 'failed' end,coalesce(nullif(note,''),'ผ่านเกณฑ์') from public.task_criteria where organization_id=org and spec_version_id=sub.spec_version_id;
    update public.submissions set status=case when new_status='accepted' then 'accepted' else 'returned' end,decided_at=clock_timestamp() where organization_id=org and id=sub.id;
    update public.task_cycles set status=new_status,accepted_submission_id=case when new_status='accepted' then sub.id else null end,
     accepted_at=case when new_status='accepted' then clock_timestamp() else null end,row_version=row_version+1 where organization_id=org and id=target;
    perform private.notify_task(org,own.owner_id,target,case when new_status='accepted' then 'ผลงานผ่านการตรวจรับ' else 'มีงานส่งกลับแก้ไข' end,spec.title,'review');
   else raise exception using errcode='0A000',message='TRANSITION_NOT_AVAILABLE'; end if;
   if new_status in ('accepted','revision') then
    insert into public.progress_reports(organization_id,task_cycle_id,author_id) values(org,target,actor) returning id into new_id;
    insert into public.progress_report_versions(organization_id,report_id,progress_percent,work_done) values(org,new_id,t.latest_progress,
     case when new_status='accepted' then 'ผลตรวจ: ผ่าน — ' else 'ผลตรวจ: ส่งกลับแก้ไข — ' end||coalesce(nullif(note,''),'ยืนยันผ่านทุกเกณฑ์'));
   end if;
   if new_status='accepted' and exists(select 1 from public.resolution_cycle_tasks where organization_id=org and resolution_cycle_id=parent and required_for_closure and valid_to is null)
    and not exists(select 1 from public.resolution_cycle_tasks l join public.task_cycles tc on tc.organization_id=org and tc.id=l.task_cycle_id where l.organization_id=org and l.resolution_cycle_id=parent and l.valid_to is null and l.required_for_closure and tc.status<>'accepted') then
    update public.resolution_cycles set status='pending_close',row_version=row_version+1 where organization_id=org and id=parent;
   end if;
   perform private.record_audit(org,actor,case new_status when 'in_progress' then 'เริ่มดำเนินงาน' when 'submitted' then 'ส่งผลงานตรวจ' when 'accepted' then 'ตรวจรับผลงาน' else 'ส่งกลับแก้ไข' end,
    'task',target,spec.title,note,p_idempotency_key,before_json,private.task_dto(org,target));

  elsif p_operation='create_change_request' then
   if not private.has_permission(org,actor,'workspace.read_all') and own.owner_id<>actor then raise exception using errcode='42501',message='FORBIDDEN'; end if;
   if t.status in ('accepted','cancelled') then raise exception using errcode='22023',message='INVALID_TRANSITION'; end if;
   if length(note)=0 or length(btrim(coalesce(p_payload->>'proposedValue','')))=0 or coalesce(p_payload->>'type','') not in ('deadline','owner','scope') then raise exception using errcode='22023',message='VALIDATION_FAILED'; end if;
   code:=private.next_code(org,'change');
   insert into public.change_requests(organization_id,task_cycle_id,code,request_type,requested_by,reason,expected_row_version)
    values(org,target,code,p_payload->>'type',actor,note,t.row_version) returning id into new_id;
   if p_payload->>'type'='deadline' then
    if p_payload->>'proposedValue'!~'^\d{4}-\d{2}-\d{2}$' then raise exception using errcode='22023',message='VALIDATION_FAILED'; end if;
    due:=(p_payload->>'proposedValue')::date;
    if due<=prev_deadline.due_on then raise exception using errcode='22023',message='INVALID_DEADLINE'; end if;
    insert into public.deadline_change_proposals(organization_id,request_id,previous_deadline_version_id,proposed_due_on) values(org,new_id,t.current_deadline_version_id,due);
   elsif p_payload->>'type'='owner' then
    new_owner:=(p_payload->>'proposedValue')::uuid;
    if not private.has_permission(org,new_owner,'task.work') or new_owner=reviewer.reviewer_id or new_owner=own.owner_id then raise exception using errcode='22023',message='INVALID_ASSIGNEE'; end if;
    insert into public.assignment_change_proposals(organization_id,request_id,previous_owner_assignment_id,proposed_profile_id) values(org,new_id,own.id,new_owner);
   else
    insert into public.scope_change_proposals(organization_id,request_id,previous_spec_version_id,proposed_description) values(org,new_id,t.current_spec_version_id,btrim(p_payload->>'proposedValue'));
   end if;
   update public.resolution_cycles set status='open',row_version=row_version+1 where organization_id=org and id=parent;
   perform private.record_audit(org,actor,'ยื่นคำขอเปลี่ยนแปลง','task',target,spec.title,note,p_idempotency_key);
   target:=new_id;

  elsif p_operation='decide_change' then
   if cr.status<>'pending' or cr.requested_by=actor then raise exception using errcode='42501',message='FORBIDDEN'; end if;
   if length(note)=0 or p_payload->>'approved' is null then raise exception using errcode='22023',message='REASON_REQUIRED'; end if;
   flag:=(p_payload->>'approved')::boolean;
   if flag then
    if t.status in ('accepted','cancelled') then raise exception using errcode='22023',message='INVALID_TRANSITION'; end if;
    -- The source version, not incidental progress updates, defines a proposal conflict.
    if cr.request_type='deadline' then
     select previous_deadline_version_id,proposed_due_on into original_version,due from public.deadline_change_proposals where organization_id=org and request_id=cr.id;
     if original_version<>t.current_deadline_version_id then raise exception using errcode='40001',message='STALE_VERSION'; end if;
     insert into public.task_deadline_versions(organization_id,task_cycle_id,version_no,due_on,approved_by,reason)
      values(org,target,prev_deadline.version_no+1,due,actor,note) returning id into new_version;
     update public.task_cycles set current_deadline_version_id=new_version,row_version=row_version+1 where organization_id=org and id=target;
    elsif cr.request_type='owner' then
     if t.status='submitted' then raise exception using errcode='22023',message='PENDING_SUBMISSION'; end if;
     select previous_owner_assignment_id,proposed_profile_id into original_version,new_owner from public.assignment_change_proposals where organization_id=org and request_id=cr.id;
     if original_version<>own.id then raise exception using errcode='40001',message='STALE_VERSION'; end if;
     if not private.has_permission(org,new_owner,'task.work') or new_owner=reviewer.reviewer_id then raise exception using errcode='22023',message='INVALID_ASSIGNEE'; end if;
     update public.owner_assignments set valid_to=clock_timestamp() where organization_id=org and id=own.id;
     insert into public.owner_assignments(organization_id,task_cycle_id,owner_id,assigned_by,reason) values(org,target,new_owner,actor,note);
     insert into public.cycle_participation_events(organization_id,task_cycle_id,profile_id,participation_kind) values(org,target,new_owner,'owner');
     update public.task_cycles set status='assigned',row_version=row_version+1 where organization_id=org and id=target;
     perform private.notify_task(org,new_owner,target,'ได้รับโอนความรับผิดชอบงาน',spec.title,'assignment');
    else
     if t.status='submitted' then raise exception using errcode='22023',message='PENDING_SUBMISSION'; end if;
     select previous_spec_version_id,proposed_description into original_version,new_description from public.scope_change_proposals where organization_id=org and request_id=cr.id;
     if original_version<>t.current_spec_version_id then raise exception using errcode='40001',message='STALE_VERSION'; end if;
     insert into public.task_spec_versions(organization_id,task_cycle_id,version_no,title,description,deliverable,priority,lead_unit_id,confirmed_by,reason)
      values(org,target,spec.version_no+1,spec.title,new_description,spec.deliverable,spec.priority,spec.lead_unit_id,actor,note) returning id into new_version;
     insert into public.task_criteria(organization_id,spec_version_id,position,description,is_required)
      select org,new_version,position,description,is_required from public.task_criteria where organization_id=org and spec_version_id=spec.id;
     update public.task_cycles set current_spec_version_id=new_version,row_version=row_version+1 where organization_id=org and id=target;
    end if;
   end if;
   update public.change_requests set status=case when flag then 'approved' else 'rejected' end,row_version=row_version+1 where organization_id=org and id=cr.id;
   insert into public.change_decisions(organization_id,request_id,decision,actor_id,reason) values(org,cr.id,case when flag then 'approved' else 'rejected' end,actor,note);
   perform private.notify_task(org,own.owner_id,target,case when flag then 'คำขอได้รับอนุมัติ' else 'คำขอไม่ได้รับอนุมัติ' end,spec.title,'change');
   perform private.record_audit(org,actor,case when flag then 'อนุมัติคำขอ' else 'ไม่อนุมัติคำขอ' end,'task',target,spec.title,note,p_idempotency_key,before_json,private.task_dto(org,target));
   target:=cr.id;
  end if;

 elsif p_operation='update_settings' then
  select configuration,version_no into config,ordinal from public.policy_versions where organization_id=org and policy_key='tracking' order by version_no desc limit 1;
  -- Serialize policy versions without requiring an exclusive authorization lock upgrade.
  perform 1 from public.organizations where id=org for update;
  select configuration,version_no into config,ordinal from public.policy_versions where organization_id=org and policy_key='tracking' order by version_no desc limit 1;
  if jsonb_typeof(p_payload->'patch') is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_payload->'patch') k where k not in ('reminderDays','acknowledgmentDays','reviewDays','emailNotifications')) then raise exception using errcode='22023',message='VALIDATION_FAILED'; end if;
  config:=config||(p_payload->'patch');
  if jsonb_typeof(config->'emailNotifications') is distinct from 'boolean'
   or jsonb_typeof(config->'acknowledgmentDays') is distinct from 'number'
   or jsonb_typeof(config->'reviewDays') is distinct from 'number'
   or coalesce(config->>'acknowledgmentDays','')!~'^\d+$' or coalesce(config->>'reviewDays','')!~'^\d+$'
   or jsonb_typeof(config->'reminderDays') is distinct from 'array' then raise exception using errcode='22023',message='VALIDATION_FAILED'; end if;
  if coalesce((config->>'emailNotifications')::boolean,false) then raise exception using errcode='0A000',message='EMAIL_NOT_AVAILABLE'; end if;
  if (config->>'acknowledgmentDays')::integer not between 1 and 30 or (config->>'reviewDays')::integer not between 1 and 60
   or jsonb_typeof(config->'reminderDays') is distinct from 'array' or jsonb_array_length(config->'reminderDays')>10
   or exists(select 1 from jsonb_array_elements(config->'reminderDays') x where jsonb_typeof(x)<>'number' or x::text!~'^\d+$') then raise exception using errcode='22023',message='VALIDATION_FAILED'; end if;
  if exists(select 1 from jsonb_array_elements_text(config->'reminderDays') x where x::integer not between 0 and 90) then raise exception using errcode='22023',message='VALIDATION_FAILED'; end if;
  insert into public.policy_versions(organization_id,policy_key,version_no,configuration,published_by) values(org,'tracking',ordinal+1,config,actor) returning id into target;
  perform private.record_audit(org,actor,'ปรับการตั้งค่า','settings',target,'การติดตาม','บันทึกค่าตั้ง; ยังไม่มี scheduler ส่งเตือนอัตโนมัติ',p_idempotency_key);
 elsif p_operation='mark_notification_read' then
  update public.notifications n set read_at=coalesce(read_at,clock_timestamp()) where n.organization_id=org and n.id=target and n.recipient_id=actor
   and (n.task_cycle_id is null or private.read_task(org,n.task_cycle_id,actor)) and (n.resolution_cycle_id is null or private.read_resolution(org,n.resolution_cycle_id,actor));
  if not found then raise exception using errcode='42501',message='NOT_FOUND'; end if;
 elsif p_operation='mark_all_read' then
  update public.notifications n set read_at=coalesce(read_at,clock_timestamp()) where n.organization_id=org and n.recipient_id=actor
   and (n.task_cycle_id is null or private.read_task(org,n.task_cycle_id,actor)) and (n.resolution_cycle_id is null or private.read_resolution(org,n.resolution_cycle_id,actor));
 end if;
 result:=jsonb_strip_nulls(jsonb_build_object('id',target));
 update private.request_deduplications set response=result where organization_id=org and actor_id=actor and operation=p_operation and idempotency_key=p_idempotency_key;
 return result;
end $$;
revoke all on function public.workspace_command(uuid,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.workspace_command(uuid,text,jsonb,uuid) to authenticated;
revoke all on all functions in schema private from public,anon,authenticated;
commit;
