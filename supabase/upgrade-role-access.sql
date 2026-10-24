-- Application roles are an upper bound on legacy workflow grants. No signup or
-- migration path creates an administrator. Run setup-admin.sql explicitly.
begin;

create table private.member_access_roles (
 organization_id uuid not null, profile_id uuid not null,
 role text not null check(role in ('admin','user','executive','staff')),
 version bigint not null default 1 check(version>0),
 updated_by uuid references public.profiles(id), updated_at timestamptz not null default now(),
 primary key(organization_id,profile_id),
 foreign key(organization_id,profile_id) references public.organization_memberships(organization_id,profile_id)
);
create table private.role_page_policies (
 organization_id uuid not null references public.organizations(id),
 role text not null check(role in ('user','executive','staff')),
 pages text[] not null,
 primary key(organization_id,role),
 check(pages <@ array['dashboard','meetings','resolutions','tasks','reviews','changes','reports','team','settings','notifications']::text[]),
 check(role<>'staff' or pages <@ array['dashboard','tasks','changes','notifications']::text[]),
 check(array_position(pages,null) is null)
);
create table private.access_policy_versions (
 organization_id uuid primary key references public.organizations(id),
 version bigint not null default 1 check(version>0)
);
alter table private.member_access_roles enable row level security;
alter table private.role_page_policies enable row level security;
alter table private.access_policy_versions enable row level security;
revoke all on private.member_access_roles,private.role_page_policies,private.access_policy_versions from public,anon,authenticated;

-- A cached JWT must not keep a disabled/banned Auth identity authoritative.
-- to_jsonb also supports local Auth test stubs without hosted-only columns.
create function private.auth_user_active(p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u where u.id=p_user
 and nullif(to_jsonb(u)->>'deleted_at','') is null
 and (nullif(to_jsonb(u)->>'banned_until','') is null or (to_jsonb(u)->>'banned_until')::timestamptz<=statement_timestamp()))
$$;
create or replace function private.current_profile() returns uuid language sql stable security definer set search_path='' as $$
 select p.id from public.auth_identities i join public.profiles p on p.id=i.profile_id
 where i.auth_user_id=auth.uid() and i.disabled_at is null and p.disabled_at is null and private.auth_user_active(i.auth_user_id)
$$;
create or replace function private.active_member(p_org uuid,p_profile uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.organization_memberships m join public.organizations o on o.id=m.organization_id
 join public.profiles p on p.id=m.profile_id
 where m.organization_id=p_org and m.profile_id=p_profile and m.status='active' and m.revoked_at is null
 and m.valid_from<=statement_timestamp() and (m.valid_to is null or m.valid_to>statement_timestamp()) and o.is_active and p.disabled_at is null
 and exists(select 1 from public.auth_identities ai where ai.profile_id=p.id and ai.disabled_at is null and private.auth_user_active(ai.auth_user_id)))
$$;

create function private.access_role(p_org uuid,p_profile uuid) returns text
language sql stable security definer set search_path='' as $$
 select case when private.active_member(p_org,p_profile) then coalesce(
  (select role from private.member_access_roles where organization_id=p_org and profile_id=p_profile),
  (select case when bool_or(role_code='secretary') then 'user' when bool_or(role_code='executive') then 'executive' else 'staff' end
   from public.access_grants where organization_id=p_org and profile_id=p_profile and revoked_at is null
   and valid_from<=statement_timestamp() and (valid_to is null or valid_to>statement_timestamp()) having count(*)>0)) end
$$;
create function private.default_role_pages(p_role text) returns text[] language sql immutable set search_path='' as $$
 select case p_role
 when 'admin' then array['dashboard','meetings','resolutions','tasks','reviews','changes','reports','team','settings','notifications']
 when 'user' then array[]::text[]
 when 'executive' then array[]::text[]
 when 'staff' then array['tasks','changes','notifications'] else array[]::text[] end
$$;
create function private.role_pages(p_org uuid,p_role text) returns text[] language sql stable security definer set search_path='' as $$
 select case when p_role='admin' then private.default_role_pages('admin') else coalesce(
 (select pages from private.role_page_policies where organization_id=p_org and role=p_role),private.default_role_pages(p_role)) end
$$;
create function private.page_enabled(p_org uuid,p_profile uuid,p_page text) returns boolean language sql stable security definer set search_path='' as $$
 select private.active_member(p_org,p_profile) and p_page=any(private.role_pages(p_org,private.access_role(p_org,p_profile)))
$$;
create function private.workflow_roles(p_role text) returns jsonb language sql immutable set search_path='' as $$
 select case p_role when 'admin' then '["secretary","owner","reviewer","executive"]'::jsonb
 when 'user' then '["secretary","owner"]'::jsonb when 'executive' then '["executive","reviewer"]'::jsonb
 when 'staff' then '["owner"]'::jsonb else '[]'::jsonb end
$$;
create function private.role_capabilities(p_role text) returns text[] language sql immutable set search_path='' as $$
 select case p_role
 when 'admin' then array['workspace.read_all','meeting.manage','resolution.draft','execution.authorize','task.assign','task.work','submission.review','change.request','deadline.approve','assignment.approve','scope.approve','resolution.close','policy.manage','report.export','access.manage']
 when 'user' then array['workspace.read_all','meeting.manage','resolution.draft','task.assign','task.work','change.request']
 when 'executive' then array['workspace.read_all','execution.authorize','deadline.approve','assignment.approve','scope.approve','resolution.close','submission.review','report.export']
 when 'staff' then array['task.work','change.request'] else array[]::text[] end
$$;
create function private.permission_page(p_permission text) returns text language sql immutable set search_path='' as $$
 select case p_permission when 'meeting.manage' then 'meetings' when 'resolution.draft' then 'resolutions'
 when 'execution.authorize' then 'resolutions' when 'resolution.close' then 'resolutions'
 when 'task.assign' then 'resolutions' when 'task.work' then 'tasks' when 'submission.review' then 'reviews'
 when 'change.request' then 'changes' when 'deadline.approve' then 'changes' when 'assignment.approve' then 'changes'
 when 'scope.approve' then 'changes' when 'policy.manage' then 'settings' when 'report.export' then 'reports'
 when 'access.manage' then 'team' end
$$;
create or replace function private.has_permission(p_org uuid,p_profile uuid,p_permission text) returns boolean
language sql stable security definer set search_path='' as $$
 select private.active_member(p_org,p_profile)
 and p_permission=any(private.role_capabilities(private.access_role(p_org,p_profile)))
 and (p_permission='workspace.read_all' or private.page_enabled(p_org,p_profile,private.permission_page(p_permission)))
$$;
create or replace function private.read_task(p_org uuid,p_cycle uuid,p_profile uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.active_member(p_org,p_profile) and private.access_role(p_org,p_profile) is not null and (
 private.has_permission(p_org,p_profile,'workspace.read_all') or exists(
 select 1 from public.owner_assignments where organization_id=p_org and task_cycle_id=p_cycle and owner_id=p_profile and valid_to is null))
$$;

-- Keep the established immutable business workflow implementation private. Its
-- permission checks now resolve canonical roles on every invocation.
alter function public.workspace_command(uuid,text,jsonb,uuid) set schema private;
alter function private.workspace_command(uuid,text,jsonb,uuid) rename to workspace_command_legacy;

create function public.workspace_command(p_organization_id uuid,p_operation text,p_payload jsonb,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; org uuid:=p_organization_id; needed_page text; target uuid; desired text;
 previous_role text; actual_version bigint; requested_pages text[]; result jsonb; prior jsonb; old_hash text; hash text;
begin
 if p_idempotency_key is null or p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>65536 then
 raise exception using errcode='22023',message='VALIDATION_FAILED'; end if;
 perform 1 from private.identity_authorization_guard where id=1 for share;
 -- Access changes use the same guard as workflow commands, with an exclusive
 -- lock. Authorization is re-read after obtaining the lock, never before it.
 if p_operation in ('set_member_role','set_role_pages') then
  perform 1 from private.authorization_guards where organization_id=org for update;
 else perform 1 from private.authorization_guards where organization_id=org for share; end if;
 actor:=private.current_profile();
 if actor is null then raise exception using errcode='42501',message='UNAUTHENTICATED'; end if;
 if not private.active_member(org,actor) or private.access_role(org,actor) is null then raise exception using errcode='42501',message='FORBIDDEN'; end if;
 needed_page:=case p_operation
 when 'add_meeting' then 'meetings' when 'add_resolution' then 'resolutions'
 when 'authorize_resolution' then 'resolutions' when 'close_resolution' then 'resolutions'
 when 'add_task' then 'resolutions' when 'acknowledge_task' then 'tasks' when 'update_progress' then 'tasks' when 'add_evidence' then 'tasks'
 when 'transition_task' then case when p_payload->>'status' in ('accepted','revision') then 'reviews' else 'tasks' end
 when 'create_change_request' then 'changes' when 'decide_change' then 'changes'
 when 'update_settings' then 'settings' when 'mark_notification_read' then 'notifications' when 'mark_all_read' then 'notifications'
 when 'set_member_role' then 'team' when 'set_role_pages' then 'team' end;
 if needed_page is null then raise exception using errcode='22023',message='UNKNOWN_OPERATION'; end if;
 if not private.page_enabled(org,actor,needed_page) then raise exception using errcode='42501',message='PAGE_ACCESS_DENIED'; end if;
 if p_operation not in ('set_member_role','set_role_pages') then
  return private.workspace_command_legacy(org,p_operation,p_payload,p_idempotency_key);
 end if;
 if private.access_role(org,actor)<>'admin' then raise exception using errcode='42501',message='FORBIDDEN'; end if;
 desired:=p_payload->>'role';
 if desired is null or desired not in ('admin','user','executive','staff') or coalesce(p_payload->>'expectedVersion','')!~'^[0-9]+$' then
  raise exception using errcode='22023',message='VALIDATION_FAILED'; end if;
 if (p_operation='set_member_role' and exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('profileId','role','expectedVersion')))
 or (p_operation='set_role_pages' and exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('role','pages','expectedVersion'))) then
  raise exception using errcode='22023',message='VALIDATION_FAILED'; end if;
 hash:=md5(p_payload::text);
 insert into private.request_deduplications(organization_id,actor_id,operation,idempotency_key,request_hash)
 values(org,actor,p_operation,p_idempotency_key,hash) on conflict do nothing;
 select request_hash,response into old_hash,prior from private.request_deduplications
 where organization_id=org and actor_id=actor and operation=p_operation and idempotency_key=p_idempotency_key for update;
 if old_hash<>hash then raise exception using errcode='22023',message='IDEMPOTENCY_CONFLICT'; end if;
 if prior is not null then return prior; end if;
 if p_operation='set_member_role' then
  target:=nullif(p_payload->>'profileId','')::uuid;
  if target is null or not private.active_member(org,target) then raise exception using errcode='22023',message='INACTIVE_MEMBER'; end if;
  select coalesce((select version from private.member_access_roles where organization_id=org and profile_id=target),0) into actual_version;
  perform private.assert_version(p_payload->>'expectedVersion',actual_version);
  previous_role:=private.access_role(org,target);
  if previous_role='admin' and desired<>'admin' and not exists(
   select 1 from private.member_access_roles where organization_id=org and profile_id<>target and role='admin' and private.active_member(org,profile_id)) then
   raise exception using errcode='42501',message='LAST_ADMIN_REQUIRED'; end if;
  insert into private.member_access_roles(organization_id,profile_id,role,updated_by) values(org,target,desired,actor)
  on conflict(organization_id,profile_id) do update set role=excluded.role,version=private.member_access_roles.version+1,updated_by=actor,updated_at=clock_timestamp();
  result:=jsonb_build_object('id',target,'version',actual_version+1);
  perform private.record_audit(org,actor,'set_member_role','access',target,'Member access',desired,p_idempotency_key,
   jsonb_build_object('role',previous_role,'version',actual_version),jsonb_build_object('role',desired,'version',actual_version+1));
 else
  if desired='admin' then raise exception using errcode='42501',message='ADMIN_PAGES_IMMUTABLE'; end if;
  if jsonb_typeof(p_payload->'pages') is distinct from 'array' or exists(select 1 from jsonb_array_elements(p_payload->'pages') v where jsonb_typeof(v)<>'string') then
   raise exception using errcode='22023',message='INVALID_PAGES'; end if;
  select coalesce(array_agg(value order by ord),'{}'::text[]) into requested_pages from jsonb_array_elements_text(p_payload->'pages') with ordinality x(value,ord);
  if not requested_pages <@ private.default_role_pages('admin') or cardinality(requested_pages)<>(select count(distinct x) from unnest(requested_pages) x)
  or (desired='staff' and not requested_pages <@ array['dashboard','tasks','changes','notifications']::text[]) then
   raise exception using errcode='22023',message='INVALID_PAGES'; end if;
  insert into private.access_policy_versions(organization_id) values(org) on conflict do nothing;
  select version into actual_version from private.access_policy_versions where organization_id=org;
  perform private.assert_version(p_payload->>'expectedVersion',actual_version);
  insert into private.role_page_policies(organization_id,role,pages) values(org,desired,requested_pages)
  on conflict(organization_id,role) do update set pages=excluded.pages;
  update private.access_policy_versions set version=version+1 where organization_id=org;
  result:=jsonb_build_object('policyVersion',actual_version+1);
  perform private.record_audit(org,actor,'set_role_pages','access',null,'Role pages',desired,p_idempotency_key,null,p_payload);
 end if;
 update private.authorization_guards set epoch=epoch+1 where organization_id=org;
 update private.request_deduplications set response=result where organization_id=org and actor_id=actor and operation=p_operation and idempotency_key=p_idempotency_key;
 return result;
end $$;

create or replace function public.get_workspace_state(p_organization_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid; org uuid; all_access boolean; summary_access boolean; result jsonb; granted_roles jsonb; permissions_json jsonb; app_role text; pages text[]; state_json jsonb; directory jsonb; member_json jsonb; policies jsonb; prior_context jsonb;
begin
 actor:=private.current_profile();
 if actor is null then raise exception using errcode='42501',message='NO_MEMBERSHIP'; end if;
 select m.organization_id into org from public.organization_memberships m
 where m.profile_id=actor and (p_organization_id is null or m.organization_id=p_organization_id)
 and private.active_member(m.organization_id,actor) order by m.valid_from,m.organization_id limit 1;
 if org is null then raise exception using errcode='42501',message='NO_MEMBERSHIP'; end if;
 app_role:=private.access_role(org,actor);
 if app_role is null then raise exception using errcode='42501',message='NO_MEMBERSHIP'; end if;
 granted_roles:=private.workflow_roles(app_role);
 pages:=private.role_pages(org,app_role);
 summary_access:='dashboard'=any(pages) or 'reports'=any(pages);
 select coalesce(jsonb_agg(cap order by cap),'[]'::jsonb) into permissions_json
 from unnest(private.role_capabilities(app_role)) cap where private.has_permission(org,actor,cap);
 all_access:=private.has_permission(org,actor,'workspace.read_all');
 with visible_tasks as materialized (
  select c.* from public.task_cycles c join public.tasks t on t.organization_id=c.organization_id and t.current_cycle_id=c.id
  where c.organization_id=org and private.read_task(org,c.id,actor)
 ), visible_resolutions as materialized (
  select c.*,r.code,r.origin_agenda_id,r.created_at,s.title,s.content,s.resolution_type,s.lead_unit_id,s.coordinator_id,s.due_on
  from public.resolution_cycles c join public.resolutions r on r.organization_id=c.organization_id and r.current_cycle_id=c.id
  join public.resolution_versions s on s.organization_id=c.organization_id and s.id=c.governing_version_id
  where c.organization_id=org and private.read_resolution(org,c.id,actor)
 ), visible_people as (
  select actor id union select o.owner_id from public.owner_assignments o join visible_tasks t on t.id=o.task_cycle_id where o.organization_id=org and o.valid_to is null
  union select r.reviewer_id from public.reviewer_assignments r join visible_tasks t on t.id=r.task_cycle_id where r.organization_id=org and r.valid_to is null
  union select coordinator_id from visible_resolutions
 ), visible_meetings as (
  select m.* from public.meetings m where m.organization_id=org and (all_access or exists(select 1 from visible_resolutions r join public.agenda_items a on a.organization_id=org and a.id=r.origin_agenda_id where a.meeting_id=m.id))
 )
 select jsonb_build_object(
 'organization',(select jsonb_build_object('id',id,'name',name_th) from public.organizations where id=org),
 'roles',granted_roles,'permissions',permissions_json,
 'units',coalesce((select jsonb_agg(name_th order by name_th) from public.organization_units where organization_id=org and is_active),'[]'::jsonb),
 'eligibleOwners',case when private.has_permission(org,actor,'change.request') or private.has_permission(org,actor,'task.assign') then
  coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name,'unit',u.name_th) order by p.display_name,p.id)
   from public.organization_memberships m join public.profiles p on p.id=m.profile_id
   join public.organization_units u on u.organization_id=org and u.id=m.unit_id
   where m.organization_id=org and private.has_permission(org,p.id,'task.work')),'[]'::jsonb)
  else '[]'::jsonb end,
 'users',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name,'initials',left(p.display_name,2),'unit',u.name_th,'avatarColor','#5f7161',
 'role',coalesce((select g.role_code from public.access_grants g where g.organization_id=org and g.profile_id=p.id and g.revoked_at is null and g.valid_from<=statement_timestamp() and (g.valid_to is null or g.valid_to>statement_timestamp())
 order by case g.role_code when 'owner' then 1 when 'reviewer' then 2 when 'secretary' then 3 else 4 end limit 1),'owner'),
 'roles',coalesce((select jsonb_agg(distinct g.role_code) from public.access_grants g where g.organization_id=org and g.profile_id=p.id and g.revoked_at is null and g.valid_from<=statement_timestamp() and (g.valid_to is null or g.valid_to>statement_timestamp())),'[]'::jsonb)) order by p.display_name,p.id)
 from public.organization_memberships m join public.profiles p on p.id=m.profile_id join public.organization_units u on u.organization_id=org and u.id=m.unit_id
 where m.organization_id=org and private.active_member(org,p.id) and (all_access or p.id in(select id from visible_people))),'[]'::jsonb),
 'state',jsonb_build_object('activeRole',granted_roles->>0,'currentUserId',actor,
 'tasks',coalesce((select jsonb_agg(private.task_dto(org,id) order by published_at desc,id) from visible_tasks),'[]'::jsonb),
 'resolutions',coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
  'id',r.id,'stableId',r.resolution_id,'rowVersion',r.row_version,'code',r.code,'title',r.title,
  'content',case when all_access then r.content else 'ข้อมูลมติส่วนที่เกี่ยวข้องกับงานที่คุณได้รับมอบหมาย' end,
  'meetingId',a.meeting_id,'agenda',a.agenda_no,'type',r.resolution_type,'unit',u.name_th,'coordinatorId',r.coordinator_id,
  'status',r.status,'createdAt',r.created_at,'dueDate',r.due_on,
  'executionAuthorized',private.execution_authorized(org,r.id),'partialContext',not all_access,
  'closureCriteria',case when all_access then coalesce((select jsonb_agg(k.description order by k.position) from public.resolution_criteria k where k.organization_id=org and k.resolution_version_id=r.governing_version_id),'[]'::jsonb) else '[]'::jsonb end)) order by r.created_at desc,r.id)
  from visible_resolutions r join public.agenda_items a on a.organization_id=org and a.id=r.origin_agenda_id join public.organization_units u on u.organization_id=org and u.id=r.lead_unit_id),'[]'::jsonb),
 'meetings',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'title',m.title,'number',m.meeting_no,'date',to_char(m.scheduled_start at time zone 'Asia/Bangkok','YYYY-MM-DD'),
  'time',to_char(m.scheduled_start at time zone 'Asia/Bangkok','HH24:MI'),'location',m.location,'status',m.status,'committee',cm.name_th,
  'agenda',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'number',a.agenda_no,'title',a.title,
  'resolutionIds',coalesce((select jsonb_agg(r.id order by r.id) from visible_resolutions r where r.origin_agenda_id=a.id),'[]'::jsonb)) order by a.agenda_no)
  from public.agenda_items a where a.organization_id=org and a.meeting_id=m.id and (all_access or exists(select 1 from visible_resolutions r where r.origin_agenda_id=a.id))),'[]'::jsonb)) order by m.scheduled_start desc,m.id)
  from visible_meetings m join public.committee_terms ct on ct.organization_id=org and ct.id=m.term_id join public.committees cm on cm.organization_id=org and cm.id=ct.committee_id),'[]'::jsonb),
 'changes',coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',c.id,'rowVersion',c.row_version,'code',c.code,'taskId',c.task_cycle_id,
 'type',c.request_type,'status',c.status,'requestedById',c.requested_by,'reason',c.reason,'createdAt',c.requested_at,
 'originalValue',case c.request_type when 'deadline' then (select due_on::text from public.task_deadline_versions where organization_id=org and id=dp.previous_deadline_version_id) when 'owner' then (select owner_id::text from public.owner_assignments where organization_id=org and id=ap.previous_owner_assignment_id) else (select description from public.task_spec_versions where organization_id=org and id=sp.previous_spec_version_id) end,
 'proposedValue',case c.request_type when 'deadline' then dp.proposed_due_on::text when 'owner' then ap.proposed_profile_id::text else sp.proposed_description end,
 'decidedAt',cd.decided_at,'decidedById',cd.actor_id,'decisionReason',cd.reason)) order by c.requested_at desc,c.id)
 from public.change_requests c join visible_tasks t on t.id=c.task_cycle_id
 left join public.deadline_change_proposals dp on dp.organization_id=org and dp.request_id=c.id
 left join public.assignment_change_proposals ap on ap.organization_id=org and ap.request_id=c.id
 left join public.scope_change_proposals sp on sp.organization_id=org and sp.request_id=c.id
 left join public.change_decisions cd on cd.organization_id=org and cd.request_id=c.id where c.organization_id=org),'[]'::jsonb),
 'notifications',coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',n.id,'title',n.title,'description',n.description,'createdAt',n.created_at,'read',n.read_at is not null,'type',n.type,
 'href',case when n.task_cycle_id is not null then '/tasks/'||n.task_cycle_id::text when n.resolution_cycle_id is not null then '/resolutions/'||n.resolution_cycle_id::text else '/' end,
 'targetId',coalesce(n.task_cycle_id,n.resolution_cycle_id))) order by n.created_at desc,n.id) from public.notifications n
 where n.organization_id=org and n.recipient_id=actor and (n.task_cycle_id is null or private.read_task(org,n.task_cycle_id,actor)) and (n.resolution_cycle_id is null or private.read_resolution(org,n.resolution_cycle_id,actor))),'[]'::jsonb),
 'audit',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'action',a.operation,'actorId',a.actor_id,'createdAt',a.recorded_at,'targetId',coalesce(a.entity_id::text,'settings'),'targetLabel',a.target_label,'detail',a.detail) order by a.recorded_at desc,a.id)
 from (select * from private.audit_events e where e.organization_id=org and (all_access or (e.entity_type='task' and private.read_task(org,e.entity_id,actor))) order by e.recorded_at desc,e.id limit 500) a),'[]'::jsonb),
 'settings',coalesce((select configuration from public.policy_versions where organization_id=org and policy_key='tracking' order by version_no desc limit 1),'{"reminderDays":[7,3,1],"acknowledgmentDays":2,"reviewDays":3,"emailNotifications":false}'::jsonb)
 )) into result;
 -- Only return data appropriate to enabled pages. Canonical staff scope is
 -- owner-only even if obsolete reviewer or secretary grants still exist.
 state_json:=result->'state';
 if not ('tasks'=any(pages) or 'reviews'=any(pages)) then
  -- Dashboard/report access authorizes a bounded reporting projection, not task
  -- evidence, updates, specification text, reviewer details or mutation access.
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
   'id',v->'id','code',v->'code','title',v->'title','resolutionId',v->'resolutionId',
   'ownerId',v->'ownerId','unit',v->'unit','status',v->'status','progress',v->'progress',
   'dueDate',v->'dueDate','originalDueDate',v->'originalDueDate','acceptedAt',v->'acceptedAt','submittedAt',v->'submittedAt',
   'rowVersion',case when 'changes'=any(pages) then v->'rowVersion' end))),'[]'::jsonb)
  into prior_context from jsonb_array_elements(state_json->'tasks') v where summary_access or 'changes'=any(pages);
  state_json:=jsonb_set(state_json,'{tasks}',prior_context);
 end if;
 if app_role='staff' then state_json:=jsonb_set(state_json,'{meetings}','[]'::jsonb);
 elsif not ('meetings'=any(pages)) then
  if summary_access then
   select coalesce(jsonb_agg(jsonb_build_object('id',v->'id','title',v->'title','number',v->'number','date',v->'date',
    'time',v->'time','location',v->'location','committee',v->'committee','status',v->'status')),'[]'::jsonb)
   into prior_context from jsonb_array_elements(state_json->'meetings') v;
  else
   -- Drafting a resolution requires choosing an existing source meeting. This
   -- selector context grants neither meeting details nor meeting mutations.
   select coalesce(jsonb_agg(jsonb_build_object('id',v->'id','title',v->'title','number',v->'number')),'[]'::jsonb)
   into prior_context from jsonb_array_elements(state_json->'meetings') v where private.has_permission(org,actor,'resolution.draft');
  end if;
  state_json:=jsonb_set(state_json,'{meetings}',prior_context);
 end if;
 if app_role='staff' or not ('resolutions'=any(pages)) then
  if app_role<>'staff' and summary_access then
   select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'id',v->'id','code',v->'code','title',v->'title','status',v->'status','type',v->'type',
    'coordinatorId',v->'coordinatorId','dueDate',v->'dueDate','createdAt',v->'createdAt','meetingId',v->'meetingId',
    'executionAuthorized',v->'executionAuthorized','partialContext',true))),'[]'::jsonb)
   into prior_context from jsonb_array_elements(state_json->'resolutions') v;
  else
   select coalesce(jsonb_agg(jsonb_build_object('id',v->'id','code',v->'code','title',v->'title','status',v->'status',
    'executionAuthorized',v->'executionAuthorized','partialContext',true)),'[]'::jsonb)
   into prior_context from jsonb_array_elements(state_json->'resolutions') v
   where exists(select 1 from jsonb_array_elements(state_json->'tasks') t where t->>'resolutionId'=v->>'id');
  end if;
  state_json:=jsonb_set(state_json,'{resolutions}',prior_context);
 end if;
 if not ('changes'=any(pages)) then state_json:=jsonb_set(state_json,'{changes}','[]'::jsonb);
 elsif app_role='staff' then
  select coalesce(jsonb_agg(v),'[]'::jsonb) into prior_context from jsonb_array_elements(state_json->'changes') v where v->>'requestedById'=actor::text;
  state_json:=jsonb_set(state_json,'{changes}',prior_context);
 end if;
 if not ('notifications'=any(pages)) then state_json:=jsonb_set(state_json,'{notifications}','[]'::jsonb); end if;
 if app_role='staff' or not ('settings'=any(pages)) then state_json:=jsonb_set(state_json,'{settings}','{}'::jsonb); end if;
 -- Audit is an organization-wide management surface; task ownership alone never grants it.
 if app_role<>'admin' or not ('settings'=any(pages)) then state_json:=jsonb_set(state_json,'{audit}','[]'::jsonb); end if;
 select coalesce(jsonb_agg(v||jsonb_build_object('accessRole',coalesce(private.access_role(org,(v->>'id')::uuid),'staff'),
  'roles',private.workflow_roles(coalesce(private.access_role(org,(v->>'id')::uuid),'staff')),
  'role',private.workflow_roles(coalesce(private.access_role(org,(v->>'id')::uuid),'staff'))->>0)),'[]'::jsonb)
 into directory from jsonb_array_elements(result->'users') v
 where v->>'id'=actor::text or (app_role<>'staff' and ('team'=any(pages)
  or exists(select 1 from jsonb_array_elements(state_json->'tasks') t where v->>'id' in (t->>'ownerId',t->>'reviewerId'))
  or exists(select 1 from jsonb_array_elements(state_json->'resolutions') r where v->>'id'=r->>'coordinatorId')
  or (private.has_permission(org,actor,'task.assign') and (private.has_permission(org,(v->>'id')::uuid,'task.work')
   or private.has_permission(org,(v->>'id')::uuid,'submission.review')))));
 result:=jsonb_set(result,'{users}',directory);
 if app_role='staff' or cardinality(pages)=0 then
  result:=jsonb_set(result,'{eligibleOwners}','[]'::jsonb);
  select coalesce(jsonb_agg(distinct v->'unit'),'[]'::jsonb) into prior_context from jsonb_array_elements(directory) v;
  result:=jsonb_set(result,'{units}',prior_context);
 elsif not private.has_permission(org,actor,'task.assign') and not private.has_permission(org,actor,'change.request') then
  result:=jsonb_set(result,'{eligibleOwners}','[]'::jsonb);
 end if;
 select coalesce(jsonb_object_agg(v->>'id',jsonb_build_object('role',coalesce(private.access_role(org,(v->>'id')::uuid),'staff'),
  'version',coalesce((select version from private.member_access_roles where organization_id=org and profile_id=(v->>'id')::uuid),0))),'{}'::jsonb)
 into member_json from jsonb_array_elements(directory) v;
 select jsonb_object_agg(r,to_jsonb(private.role_pages(org,r))) into policies from unnest(array['admin','user','executive','staff']) r;
 result:=jsonb_set(result,'{state}',state_json)||jsonb_build_object('access',jsonb_build_object('role',app_role,'pages',to_jsonb(pages),
  'policies',policies,'policyVersion',coalesce((select version from private.access_policy_versions where organization_id=org),1),'members',member_json));
 return result;
end $$;


-- Explicit, private bootstrap for an existing active member in a named existing
-- organization. It does not create/revive identities, memberships or organizations.
create function private.bootstrap_admin(p_email text,p_org uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare person uuid; user_id uuid; matches bigint; identity_record record; old_role text;
begin
 perform 1 from private.identity_authorization_guard where id=1 for update;
 if not found then raise exception 'IDENTITY_GUARD_MISSING'; end if;
 if p_org is null or p_email is null or position('@' in btrim(p_email))<2 then raise exception 'EXPLICIT_EMAIL_AND_ORGANIZATION_REQUIRED'; end if;
 perform 1 from private.authorization_guards where organization_id=p_org for update;
 if not found or not exists(select 1 from public.organizations where id=p_org and is_active) then raise exception 'TARGET_ORGANIZATION_NOT_FOUND_OR_INACTIVE'; end if;
 select count(*) into matches from auth.users where lower(email)=lower(btrim(p_email));
 if matches<>1 then raise exception 'AUTH_EMAIL_MUST_MATCH_EXACTLY_ONE_USER'; end if;
 select id into user_id from auth.users where lower(email)=lower(btrim(p_email));
 if exists(select 1 from auth.users u where u.id=user_id and (
  nullif(to_jsonb(u)->>'deleted_at','') is not null or nullif(to_jsonb(u)->>'banned_until','')::timestamptz>statement_timestamp())) then
  raise exception 'BLOCKED_AUTH_USER'; end if;
 select i.profile_id,i.disabled_at identity_disabled,p.disabled_at profile_disabled into identity_record
 from public.auth_identities i join public.profiles p on p.id=i.profile_id where i.auth_user_id=user_id;
 person:=identity_record.profile_id;
 if person is null or identity_record.identity_disabled is not null or identity_record.profile_disabled is not null then raise exception 'ACTIVE_EXISTING_IDENTITY_REQUIRED'; end if;
 if not private.active_member(p_org,person) then raise exception 'ACTIVE_EXISTING_MEMBERSHIP_REQUIRED'; end if;
 old_role:=private.access_role(p_org,person);
 if old_role<>'admin' or old_role is null then
  insert into private.member_access_roles(organization_id,profile_id,role,updated_by) values(p_org,person,'admin',person)
  on conflict(organization_id,profile_id) do update set role='admin',version=private.member_access_roles.version+1,updated_by=person,updated_at=clock_timestamp();
  update private.authorization_guards set epoch=epoch+1 where organization_id=p_org;
  perform private.record_audit(p_org,person,'bootstrap_admin','access',person,'Explicit administrator bootstrap','Database administrator selected an existing Auth email and organization',gen_random_uuid(),jsonb_build_object('role',old_role),jsonb_build_object('role','admin'));
 end if;
 return jsonb_build_object('organizationId',p_org,'profileId',person,'role',private.access_role(p_org,person),'pages',private.role_pages(p_org,'admin'));
end $$;

revoke all on function public.workspace_command(uuid,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.workspace_command(uuid,text,jsonb,uuid) to authenticated;
revoke all on all functions in schema private from public,anon,authenticated;
commit;
