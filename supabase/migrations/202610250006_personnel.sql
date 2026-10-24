-- Admin-created personnel are reservations, not Auth users or active memberships.
-- Re-running this upgrade preserves existing reservations and wrapped functions.
begin;

create table if not exists private.personnel_invitations (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 first_name text not null check(length(first_name) between 1 and 100),
 last_name text not null check(length(last_name) between 1 and 100),
 email text not null check(email=lower(btrim(email)) and length(email)<=254),
 unit_id uuid not null,
 role text not null check(role in ('admin','user','executive','staff')),
 version bigint not null default 1 check(version>0),
 created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 claimed_at timestamptz, claimed_by uuid references public.profiles(id),
 unique(organization_id,email),
 foreign key(organization_id,unit_id) references public.organization_units(organization_id,id),
 check((claimed_at is null)=(claimed_by is null))
);
create index if not exists personnel_pending_email on private.personnel_invitations(email,organization_id) where claimed_at is null;
alter table private.personnel_invitations enable row level security;
revoke all on private.personnel_invitations from public,anon,authenticated;

do $$ begin
 if to_regprocedure('private.workspace_command_roles(uuid,text,jsonb,uuid)') is null then
  alter function public.workspace_command(uuid,text,jsonb,uuid) set schema private;
  alter function private.workspace_command(uuid,text,jsonb,uuid) rename to workspace_command_roles;
 end if;
 if to_regprocedure('private.get_workspace_state_roles(uuid)') is null then
  alter function public.get_workspace_state(uuid) set schema private;
  alter function private.get_workspace_state(uuid) rename to get_workspace_state_roles;
 end if;
end $$;

create or replace function public.workspace_command(p_organization_id uuid,p_operation text,p_payload jsonb,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; org uuid:=p_organization_id; target uuid; desired text; given_name text; family_name text; address text;
 unit uuid; reservation private.personnel_invitations%rowtype; result jsonb; prior jsonb; old_hash text; hash text;
begin
 if p_operation not in ('add_personnel','set_pending_personnel_role') or p_operation is null then
  return private.workspace_command_roles(org,p_operation,p_payload,p_idempotency_key);
 end if;
 if p_idempotency_key is null or p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>65536 then
  raise exception using errcode='22023',message='VALIDATION_FAILED'; end if;
 perform 1 from private.identity_authorization_guard where id=1 for share;
 perform 1 from private.authorization_guards where organization_id=org for update;
 actor:=private.current_profile();
 if actor is null then raise exception using errcode='42501',message='UNAUTHENTICATED'; end if;
 if private.access_role(org,actor) is distinct from 'admin' then raise exception using errcode='42501',message='FORBIDDEN'; end if;
 perform private.require_permission(org,actor,'access.manage');
 desired:=p_payload->>'role';
 if jsonb_typeof(p_payload->'role') is distinct from 'string' or desired not in ('admin','user','executive','staff') then
  raise exception using errcode='22023',message='VALIDATION_FAILED'; end if;
 if p_operation='add_personnel' then
  if exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('firstName','lastName','email','unit','role'))
  or exists(select 1 from unnest(array['firstName','lastName','email','unit']) k where jsonb_typeof(p_payload->k) is distinct from 'string') then
   raise exception using errcode='22023',message='VALIDATION_FAILED'; end if;
  given_name:=btrim(p_payload->>'firstName'); family_name:=btrim(p_payload->>'lastName'); address:=lower(btrim(p_payload->>'email'));
  if length(given_name) not between 1 and 100 or length(family_name) not between 1 and 100
   or given_name~'[[:cntrl:]]' or family_name~'[[:cntrl:]]'
   or length(address)>254 or address!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
   or length(btrim(p_payload->>'unit')) not between 1 and 300 then
   raise exception using errcode='22023',message='VALIDATION_FAILED'; end if;
 else
  if exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('invitationId','role','expectedVersion'))
   or jsonb_typeof(p_payload->'invitationId') is distinct from 'string'
   or coalesce(p_payload->>'invitationId','')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   or coalesce(p_payload->>'expectedVersion','')!~'^[0-9]{1,18}$' then
   raise exception using errcode='22023',message='VALIDATION_FAILED'; end if;
  target:=(p_payload->>'invitationId')::uuid;
 end if;
 hash:=md5(p_payload::text);
 insert into private.request_deduplications(organization_id,actor_id,operation,idempotency_key,request_hash)
 values(org,actor,p_operation,p_idempotency_key,hash) on conflict do nothing;
 select request_hash,response into old_hash,prior from private.request_deduplications
 where organization_id=org and actor_id=actor and operation=p_operation and idempotency_key=p_idempotency_key for update;
 if old_hash<>hash then raise exception using errcode='22023',message='IDEMPOTENCY_CONFLICT'; end if;
 if prior is not null then return prior; end if;
 if p_operation='add_personnel' then
  unit:=private.unit_id(org,btrim(p_payload->>'unit'));
  if exists(select 1 from private.personnel_invitations where organization_id=org and email=address) then
   raise exception using errcode='23505',message='PERSONNEL_ALREADY_EXISTS'; end if;
  -- Even inactive/revoked memberships must be managed deliberately, never revived by signup.
  if exists(select 1 from auth.users u join public.auth_identities i on i.auth_user_id=u.id
   join public.organization_memberships m on m.profile_id=i.profile_id
   where m.organization_id=org and lower(btrim(u.email))=address) then
   raise exception using errcode='23505',message='MEMBER_ALREADY_EXISTS'; end if;
  insert into private.personnel_invitations(organization_id,first_name,last_name,email,unit_id,role,created_by)
  values(org,given_name,family_name,address,unit,desired,actor) returning id into target;
  result:=jsonb_build_object('id',target,'status','pending');
  perform private.record_audit(org,actor,'add_personnel','personnel',target,given_name||' '||family_name,'Personnel awaiting verified registration',p_idempotency_key,
   null,jsonb_build_object('role',desired,'unitId',unit,'version',1));
 else
  select * into reservation from private.personnel_invitations where organization_id=org and id=target for update;
  if not found then raise exception using errcode='22023',message='NOT_FOUND'; end if;
  if reservation.claimed_at is not null then raise exception using errcode='22023',message='INVITATION_CLAIMED'; end if;
  perform private.assert_version(p_payload->>'expectedVersion',reservation.version);
  update private.personnel_invitations set role=desired,version=version+1,updated_at=clock_timestamp() where id=target;
  result:=jsonb_build_object('id',target,'version',reservation.version+1);
  perform private.record_audit(org,actor,'set_pending_personnel_role','personnel',target,reservation.first_name||' '||reservation.last_name,desired,p_idempotency_key,
   jsonb_build_object('role',reservation.role,'version',reservation.version),jsonb_build_object('role',desired,'version',reservation.version+1));
 end if;
 update private.authorization_guards set epoch=epoch+1 where organization_id=org;
 update private.request_deduplications set response=result where organization_id=org and actor_id=actor and operation=p_operation and idempotency_key=p_idempotency_key;
 return result;
end $$;

-- email_confirmed_at alone also represents Auth's autoconfirm configuration.
-- Supabase's email identity starts with email_verified=false and signupVerify
-- sets it true after token verification. raw_user_meta_data is never trusted.
-- Password changes clear confirmation_sent_at, so it is not lasting proof.
create or replace function public.claim_workspace_invitations() returns jsonb
language plpgsql security definer set search_path='' as $$
declare user_id uuid:=auth.uid(); address text; verified boolean:=false; person uuid; identity_record record;
 reservation private.personnel_invitations%rowtype; claim_count integer:=0; org_id uuid;
begin
 if user_id is null then raise exception using errcode='42501',message='UNAUTHENTICATED'; end if;
 perform 1 from private.identity_authorization_guard where id=1 for update;
 if not found then raise exception 'IDENTITY_GUARD_MISSING'; end if;
 select lower(btrim(u.email)),
  nullif(to_jsonb(u)->>'email_confirmed_at','') is not null and exists(
   select 1 from auth.identities ai where ai.user_id=u.id and ai.provider='email'
    and lower(btrim(ai.identity_data->>'email'))=lower(btrim(u.email))
    and ai.identity_data->'email_verified'='true'::jsonb)
 into address,verified from auth.users u where u.id=user_id and private.auth_user_active(u.id);
 if address is null or address='' or not coalesce(verified,false) then
  return jsonb_build_object('claimed',0,'emailVerified',false); end if;
 -- A duplicated email across Auth identities is ambiguous even if one is disabled.
 if (select count(*) from auth.users where lower(btrim(email))=address)<>1 then
  return jsonb_build_object('claimed',0,'emailVerified',true); end if;
 select i.profile_id,i.disabled_at identity_disabled,p.disabled_at profile_disabled into identity_record
 from public.auth_identities i join public.profiles p on p.id=i.profile_id where i.auth_user_id=user_id;
 person:=identity_record.profile_id;
 if person is not null and (identity_record.identity_disabled is not null or identity_record.profile_disabled is not null) then
  return jsonb_build_object('claimed',0,'emailVerified',true); end if;
 -- All identity operations use the global guard first; then lock organizations
 -- in a deterministic order before re-reading invitations and memberships.
 for org_id in select distinct organization_id from private.personnel_invitations where email=address and claimed_at is null order by organization_id loop
  perform 1 from private.authorization_guards where organization_id=org_id for update;
 end loop;
 for reservation in select i.* from private.personnel_invitations i
  join public.organizations o on o.id=i.organization_id and o.is_active
  join public.organization_units u on u.organization_id=i.organization_id and u.id=i.unit_id and u.is_active
  where i.email=address and i.claimed_at is null order by i.organization_id,i.id for update of i loop
  if person is not null and exists(select 1 from public.organization_memberships where organization_id=reservation.organization_id and profile_id=person) then
   continue; -- Never overwrite an existing membership, including inactive ones.
  end if;
  if person is null then
   insert into public.profiles(display_name) values(reservation.first_name||' '||reservation.last_name) returning id into person;
   insert into public.auth_identities(profile_id,auth_user_id) values(person,user_id);
  end if;
  insert into public.organization_memberships(organization_id,profile_id,unit_id) values(reservation.organization_id,person,reservation.unit_id);
  insert into private.member_access_roles(organization_id,profile_id,role,updated_by)
   values(reservation.organization_id,person,reservation.role,reservation.created_by);
  update private.personnel_invitations set claimed_at=clock_timestamp(),claimed_by=person,version=version+1,updated_at=clock_timestamp() where id=reservation.id;
  update private.authorization_guards set epoch=epoch+1 where organization_id=reservation.organization_id;
  perform private.record_audit(reservation.organization_id,person,'claim_personnel','personnel',reservation.id,
   reservation.first_name||' '||reservation.last_name,'Verified email claimed preconfigured personnel access',gen_random_uuid(),
   jsonb_build_object('status','pending','role',reservation.role),jsonb_build_object('status','active','role',reservation.role,'profileId',person));
  claim_count:=claim_count+1;
 end loop;
 return jsonb_build_object('claimed',claim_count,'emailVerified',true);
end $$;

create or replace function public.get_workspace_state(p_organization_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; org uuid; actor uuid; administrator boolean; directory jsonb; pending jsonb; members jsonb;
begin
 result:=private.get_workspace_state_roles(p_organization_id);
 org:=(result->'organization'->>'id')::uuid; actor:=(result->'state'->>'currentUserId')::uuid;
 administrator:=result->'access'->>'role'='admin';
 -- Names entered by this organization's Admin remain local to its directory.
 -- A person's existing global profile and other organizations are untouched.
 select coalesce(jsonb_agg(v||jsonb_strip_nulls(jsonb_build_object(
  'membershipStatus','active','name',case when i.id is not null then i.first_name||' '||i.last_name end,
  'firstName',i.first_name,'lastName',i.last_name,
  'email',case when administrator or v->>'id'=actor::text then coalesce(i.email,(
   select lower(btrim(u.email)) from public.auth_identities ai join auth.users u on u.id=ai.auth_user_id
   where ai.profile_id=(v->>'id')::uuid and ai.disabled_at is null and private.auth_user_active(u.id) order by ai.linked_at,ai.id limit 1)) end)
  ) order by ord),'[]'::jsonb) into directory
 from jsonb_array_elements(result->'users') with ordinality x(v,ord)
 left join private.personnel_invitations i on i.organization_id=org and i.claimed_by=(v->>'id')::uuid;
 -- Pending personnel are never included in eligibleOwners or workflow queries.
 if administrator then
  select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'name',i.first_name||' '||i.last_name,
   'firstName',i.first_name,'lastName',i.last_name,'email',i.email,'initials',left(i.first_name,1)||left(i.last_name,1),
   'unit',u.name_th,'avatarColor','#5f7161','role',private.workflow_roles(i.role)->>0,
   'roles',private.workflow_roles(i.role),'accessRole',i.role,'membershipStatus','pending') order by i.created_at,i.id),'[]'::jsonb),
   coalesce(jsonb_object_agg(i.id::text,jsonb_build_object('role',i.role,'version',i.version)),'{}'::jsonb)
  into pending,members from private.personnel_invitations i
  join public.organization_units u on u.organization_id=org and u.id=i.unit_id where i.organization_id=org and i.claimed_at is null;
  directory:=directory||pending;
  result:=jsonb_set(result,'{access,members}',(result->'access'->'members')||members);
 end if;
 return jsonb_set(result,'{users}',directory)||jsonb_build_object('features',jsonb_build_object('personnelManagement',true));
end $$;

revoke all on all functions in schema private from public,anon,authenticated;
revoke all on function public.workspace_command(uuid,text,jsonb,uuid),public.get_workspace_state(uuid),public.claim_workspace_invitations() from public,anon,authenticated;
grant execute on function public.workspace_command(uuid,text,jsonb,uuid),public.get_workspace_state(uuid),public.claim_workspace_invitations() to authenticated;
commit;
