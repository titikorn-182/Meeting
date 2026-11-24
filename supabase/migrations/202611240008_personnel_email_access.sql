-- Policy approved 2026-11-24: authenticated, active, non-anonymous accounts may
-- claim existing administrator-approved reservations by canonical Auth email.
-- Mailbox ownership is not verified by this policy. No roles come from client metadata.
-- Apply after 006; compatible with or without 007. Rerunnable. No Auth records changed.
begin;
create or replace function public.claim_workspace_invitations() returns jsonb
language plpgsql security definer set search_path='' as $$
declare user_id uuid:=auth.uid(); address text; person uuid; identity_record record;
 reservation private.personnel_invitations%rowtype; claim_count integer:=0; org_id uuid;
begin
 if user_id is null then raise exception using errcode='42501',message='UNAUTHENTICATED'; end if;
 perform 1 from private.identity_authorization_guard where id=1 for update;
 if not found then raise exception 'IDENTITY_GUARD_MISSING'; end if;
 select lower(btrim(u.email)) into address from auth.users u
 where u.id=user_id and private.auth_user_active(u.id)
 and coalesce(to_jsonb(u)->>'is_anonymous','false')='false';
 if address is null or address='' then
  return jsonb_build_object('claimed',0,'emailVerificationRequired',false,'claimPolicy','admin_email_match'); end if;
 -- A duplicated email across Auth identities is ambiguous even if one is disabled.
 if (select count(*) from auth.users where lower(btrim(email))=address)<>1 then
  return jsonb_build_object('claimed',0,'emailVerificationRequired',false,'claimPolicy','admin_email_match'); end if;
 select i.profile_id,i.disabled_at identity_disabled,p.disabled_at profile_disabled into identity_record
 from public.auth_identities i join public.profiles p on p.id=i.profile_id where i.auth_user_id=user_id;
 person:=identity_record.profile_id;
 if person is not null and (identity_record.identity_disabled is not null or identity_record.profile_disabled is not null) then
  return jsonb_build_object('claimed',0,'emailVerificationRequired',false,'claimPolicy','admin_email_match'); end if;
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
   reservation.first_name||' '||reservation.last_name,'Authenticated account claimed administrator-approved email reservation',gen_random_uuid(),
   jsonb_build_object('status','pending','role',reservation.role),jsonb_build_object('status','active','role',reservation.role,'profileId',person));
  claim_count:=claim_count+1;
 end loop;
 return jsonb_build_object('claimed',claim_count,'emailVerificationRequired',false,'claimPolicy','admin_email_match');
end $$;

revoke all on function public.claim_workspace_invitations() from public,anon;
grant execute on function public.claim_workspace_invitations() to authenticated;
commit;
