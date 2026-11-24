-- Additive, rerunnable meeting editing and follow-up links. Run after migrations 001–006.
begin;
create table if not exists private.meeting_resolution_followups (
  organization_id uuid not null references public.organizations(id),
  agenda_id uuid not null, resolution_cycle_id uuid not null,
  note text not null check(length(note) between 1 and 2000),
  snapshot_status text not null, recorded_at timestamptz not null default now(),
  recorded_by uuid not null references public.profiles(id),
  primary key(organization_id,agenda_id,resolution_cycle_id),
  foreign key(organization_id,agenda_id) references public.agenda_items(organization_id,id),
  foreign key(organization_id,resolution_cycle_id) references public.resolution_cycles(organization_id,id)
);
alter table private.meeting_resolution_followups enable row level security;
revoke all on private.meeting_resolution_followups from public,anon,authenticated;
do $$ begin
 if to_regprocedure('private.workspace_command_personnel(uuid,text,jsonb,uuid)') is null then
  alter function public.workspace_command(uuid,text,jsonb,uuid) set schema private;
  alter function private.workspace_command(uuid,text,jsonb,uuid) rename to workspace_command_personnel;
 end if;
 if to_regprocedure('private.get_workspace_state_personnel(uuid)') is null then
  alter function public.get_workspace_state(uuid) set schema private;
  alter function private.get_workspace_state(uuid) rename to get_workspace_state_personnel;
 end if;
end $$;

create or replace function public.workspace_command(p_organization_id uuid,p_operation text,p_payload jsonb,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid:=p_organization_id; actor uuid; target uuid; item public.meetings%rowtype;
 prior jsonb; old_hash text; hash text; result jsonb; agenda uuid; cycle uuid; cycle_status text; original_agenda uuid; note text;
begin
 if p_operation not in ('update_meeting','add_agenda','link_resolution') or p_operation is null then
  return private.workspace_command_personnel(org,p_operation,p_payload,p_idempotency_key);
 end if;
 if p_idempotency_key is null or p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>65536 then
  raise exception using errcode='22023',message='VALIDATION_FAILED'; end if;
 perform 1 from private.identity_authorization_guard where id=1 for share;
 perform 1 from private.authorization_guards where organization_id=org for share;
 actor:=private.current_profile();
 if actor is null then raise exception using errcode='42501',message='UNAUTHENTICATED'; end if;
 perform private.require_permission(org,actor,'meeting.manage');
 if not private.page_enabled(org,actor,'meetings') then raise exception using errcode='42501',message='PAGE_ACCESS_DENIED'; end if;
 if p_operation='link_resolution' then
  perform private.require_permission(org,actor,'resolution.draft');
  if not private.page_enabled(org,actor,'resolutions') then raise exception using errcode='42501',message='PAGE_ACCESS_DENIED'; end if;
 end if;
 hash:=md5(p_payload::text);
 insert into private.request_deduplications(organization_id,actor_id,operation,idempotency_key,request_hash)
 values(org,actor,p_operation,p_idempotency_key,hash) on conflict do nothing;
 select request_hash,response into old_hash,prior from private.request_deduplications
 where organization_id=org and actor_id=actor and operation=p_operation and idempotency_key=p_idempotency_key for update;
 if old_hash<>hash then raise exception using errcode='22023',message='IDEMPOTENCY_CONFLICT'; end if;
 if prior is not null then return prior; end if;
 target:=(p_payload->>'id')::uuid;
 select * into item from public.meetings where organization_id=org and id=target for update;
 if not found then raise exception using errcode='22023',message='NOT_FOUND'; end if;
 perform private.assert_version(p_payload->>'expectedVersion',item.row_version);
 if p_operation='update_meeting' then
  if exists(select 1 from unnest(array['title','date','time','location','status','reason']) k where jsonb_typeof(p_payload->k) is distinct from 'string')
   or length(btrim(p_payload->>'title')) not between 1 and 500 or length(btrim(p_payload->>'location')) not between 1 and 1000
   or length(btrim(p_payload->>'reason')) not between 1 and 2000 or p_payload->>'status' not in ('scheduled','completed')
   or p_payload->>'date'!~'^\d{4}-\d{2}-\d{2}$' or p_payload->>'time'!~'^([01]\d|2[0-3]):[0-5]\d$' then
   raise exception using errcode='22023',message='VALIDATION_FAILED'; end if;
  update public.meetings set title=btrim(p_payload->>'title'),location=btrim(p_payload->>'location'),status=p_payload->>'status',
   scheduled_start=((p_payload->>'date')||' '||(p_payload->>'time'))::timestamp at time zone 'Asia/Bangkok' where id=target and organization_id=org;
  note:=btrim(p_payload->>'reason');
 elsif p_operation='add_agenda' then
  if jsonb_typeof(p_payload->'number') is distinct from 'string' or jsonb_typeof(p_payload->'title') is distinct from 'string'
   or length(btrim(p_payload->>'number')) not between 1 and 50 or length(btrim(p_payload->>'title')) not between 1 and 1000
   or (select count(*) from public.agenda_items where organization_id=org and meeting_id=target)>=100 then
   raise exception using errcode='22023',message='VALIDATION_FAILED'; end if;
  insert into public.agenda_items(organization_id,meeting_id,agenda_no,title)
   values(org,target,btrim(p_payload->>'number'),btrim(p_payload->>'title')) returning id into agenda;
  note:=btrim(p_payload->>'title');
 else
  agenda:=(p_payload->>'agendaId')::uuid; cycle:=(p_payload->>'resolutionId')::uuid; note:=btrim(p_payload->>'note');
  if jsonb_typeof(p_payload->'note') is distinct from 'string' or length(note) not between 1 and 2000 then
   raise exception using errcode='22023',message='VALIDATION_FAILED'; end if;
  if not exists(select 1 from public.agenda_items where organization_id=org and meeting_id=target and id=agenda)
   or not private.read_resolution(org,cycle,actor) then raise exception using errcode='42501',message='FORBIDDEN'; end if;
  select c.status,r.origin_agenda_id into cycle_status,original_agenda from public.resolution_cycles c
   join public.resolutions r on r.organization_id=org and r.id=c.resolution_id where c.organization_id=org and c.id=cycle for share of c;
  if not found then raise exception using errcode='22023',message='NOT_FOUND'; end if;
  if original_agenda=agenda then raise exception using errcode='22023',message='VALIDATION_FAILED'; end if;
  insert into private.meeting_resolution_followups(organization_id,agenda_id,resolution_cycle_id,note,snapshot_status,recorded_by)
   values(org,agenda,cycle,note,cycle_status,actor);
 end if;
 update public.meetings set row_version=row_version+1 where organization_id=org and id=target;
 result:=jsonb_build_object('id',target,'version',item.row_version+1);
 perform private.record_audit(org,actor,p_operation,'meeting',target,item.title,note,p_idempotency_key,
  to_jsonb(item),p_payload||jsonb_build_object('version',item.row_version+1));
 update private.request_deduplications set response=result where organization_id=org and actor_id=actor and operation=p_operation and idempotency_key=p_idempotency_key;
 return result;
end $$;

create or replace function public.get_workspace_state(p_organization_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; org uuid; actor uuid; meetings jsonb; agendas jsonb; meeting jsonb; a jsonb; linked jsonb; followups jsonb; output jsonb:='[]'::jsonb;
begin
 result:=private.get_workspace_state_personnel(p_organization_id);
 org:=(result->'organization'->>'id')::uuid; actor:=(result->'state'->>'currentUserId')::uuid;
 -- Start with the prior authorized projection; never expand a hidden collection or field.
 if private.page_enabled(org,actor,'meetings') and result->'access'->>'role'<>'staff' then
  meetings:=result->'state'->'meetings';
  for meeting in select value from jsonb_array_elements(meetings) loop
   agendas:='[]'::jsonb;
   for a in select value from jsonb_array_elements(meeting->'agenda') loop
    select coalesce(jsonb_agg(f.resolution_cycle_id order by f.recorded_at,f.resolution_cycle_id),'[]'::jsonb),
     coalesce(jsonb_agg(jsonb_build_object('resolutionId',f.resolution_cycle_id,'recordedAt',f.recorded_at,'status',f.snapshot_status,'note',f.note) order by f.recorded_at,f.resolution_cycle_id),'[]'::jsonb)
     into linked,followups from private.meeting_resolution_followups f where f.organization_id=org and f.agenda_id=(a->>'id')::uuid
     and exists(select 1 from jsonb_array_elements(result->'state'->'resolutions') r where r->>'id'=f.resolution_cycle_id::text);
    agendas:=agendas||jsonb_build_array(a||jsonb_build_object('resolutionIds',(a->'resolutionIds')||linked,'followups',followups));
   end loop;
   output:=output||jsonb_build_array(meeting||jsonb_build_object('agenda',agendas,'rowVersion',(select row_version from public.meetings where organization_id=org and id=(meeting->>'id')::uuid)));
  end loop;
  result:=jsonb_set(result,'{state,meetings}',output);
 end if;
 return jsonb_set(result,'{features}',coalesce(result->'features','{}'::jsonb)||jsonb_build_object('meetingManagement',true));
end $$;
revoke all on function private.workspace_command_personnel(uuid,text,jsonb,uuid),private.get_workspace_state_personnel(uuid) from public,anon,authenticated;
revoke all on function public.workspace_command(uuid,text,jsonb,uuid),public.get_workspace_state(uuid) from public,anon;
grant execute on function public.workspace_command(uuid,text,jsonb,uuid),public.get_workspace_state(uuid) to authenticated;
commit;
