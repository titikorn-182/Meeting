begin;
create function private.task_dto(p_org uuid,p_cycle uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_strip_nulls(jsonb_build_object(
 'id',c.id,'stableId',t.id,'rowVersion',c.row_version,'code',t.code,'resolutionId',l.resolution_cycle_id,
 'title',s.title,'ownerId',o.owner_id,'reviewerId',v.reviewer_id,'unit',u.name_th,'priority',s.priority,'status',c.status,
 'progress',c.latest_progress,'originalDueDate',d0.due_on,'dueDate',d.due_on,'required',l.required_for_closure,
 'description',s.description,'deliverable',s.deliverable,
 'criteria',coalesce((select jsonb_agg(k.description order by k.position) from public.task_criteria k where k.organization_id=p_org and k.spec_version_id=s.id),'[]'::jsonb),
 'evidence',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'name',e.title,'size','ลิงก์อ้างอิง','kind','link','url',dv.source_url,'uploadedAt',e.added_at) order by e.added_at,e.id)
 from public.task_evidence_links e join public.document_versions dv on dv.organization_id=e.organization_id and dv.id=e.document_version_id where e.organization_id=p_org and e.task_cycle_id=c.id),'[]'::jsonb),
 'updates',coalesce((select jsonb_agg(jsonb_build_object('id',pv.id,'note',pv.work_done,'progress',pv.progress_percent,'createdAt',pv.published_at,'authorId',pr.author_id) order by pv.published_at,pv.id)
 from public.progress_reports pr join public.progress_report_versions pv on pv.organization_id=pr.organization_id and pv.report_id=pr.id where pr.organization_id=p_org and pr.task_cycle_id=c.id),'[]'::jsonb),
 'submittedAt',(select submitted_at from public.submissions sub where sub.organization_id=p_org and sub.task_cycle_id=c.id order by attempt_no desc limit 1),
 'acceptedAt',c.accepted_at,'acknowledgedAt',o.acknowledged_at))
 from public.task_cycles c join public.tasks t on t.organization_id=c.organization_id and t.id=c.task_id
 join public.task_spec_versions s on s.organization_id=c.organization_id and s.id=c.current_spec_version_id
 join public.organization_units u on u.organization_id=c.organization_id and u.id=s.lead_unit_id
 join public.resolution_cycle_tasks l on l.organization_id=c.organization_id and l.task_cycle_id=c.id and l.valid_to is null
 join public.owner_assignments o on o.organization_id=c.organization_id and o.task_cycle_id=c.id and o.valid_to is null
 join public.reviewer_assignments v on v.organization_id=c.organization_id and v.task_cycle_id=c.id and v.valid_to is null
 join public.task_deadline_versions d on d.organization_id=c.organization_id and d.id=c.current_deadline_version_id
 join public.task_deadline_versions d0 on d0.organization_id=c.organization_id and d0.id=c.original_deadline_version_id
 where c.organization_id=p_org and c.id=p_cycle
$$;

create function public.get_workspace_state(p_organization_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid; org uuid; all_access boolean; result jsonb; granted_roles jsonb; permissions_json jsonb;
begin
 actor:=private.current_profile();
 if actor is null then raise exception using errcode='42501',message='NO_MEMBERSHIP'; end if;
 select m.organization_id into org from public.organization_memberships m
 where m.profile_id=actor and (p_organization_id is null or m.organization_id=p_organization_id)
 and private.active_member(m.organization_id,actor) order by m.valid_from,m.organization_id limit 1;
 if org is null then raise exception using errcode='42501',message='NO_MEMBERSHIP'; end if;
 select coalesce(jsonb_agg(code order by priority),'[]'::jsonb) into granted_roles from (
 select distinct g.role_code code,case g.role_code when 'secretary' then 1 when 'executive' then 2 when 'owner' then 3 else 4 end priority
 from public.access_grants g where g.organization_id=org and g.profile_id=actor and g.revoked_at is null
 and g.valid_from<=statement_timestamp() and (g.valid_to is null or g.valid_to>statement_timestamp())) gr;
 if jsonb_array_length(granted_roles)=0 then raise exception using errcode='42501',message='NO_MEMBERSHIP'; end if;
 select coalesce(jsonb_agg(code order by code),'[]'::jsonb) into permissions_json from (
 select distinct rp.permission_code code from public.access_grants g join public.role_permissions rp on rp.role_code=g.role_code
 where g.organization_id=org and g.profile_id=actor and g.revoked_at is null and g.valid_from<=statement_timestamp() and (g.valid_to is null or g.valid_to>statement_timestamp())) pr;
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
 return result;
end $$;
revoke all on function public.get_workspace_state(uuid) from public,anon,authenticated;
grant execute on function public.get_workspace_state(uuid) to authenticated;
revoke all on all functions in schema private from public,anon,authenticated;
commit;
