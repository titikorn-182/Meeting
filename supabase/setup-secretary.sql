-- สำหรับผู้ดูแลฐานข้อมูล: แก้ YOUR_LOGIN_EMAIL แล้วรันทั้งไฟล์ใน Supabase SQL Editor
-- ให้เฉพาะ secretary แก่บัญชี Auth ที่มีอยู่แล้ว ไม่สร้างบัญชีหรือให้สิทธิ์ executive
-- หากมีหลายองค์กร ให้ระบุ target_organization_id ก่อนรัน; ตรวจผล organization_id ด้านล่าง
-- Clear only this session's previous result; a failed rerun must not show stale success.
drop table if exists pg_temp.setup_secretary_result;
begin;
do $$
declare
  target_email text := 'YOUR_LOGIN_EMAIL';
  target_organization_id uuid := null;
  organization_name text := 'POLUBU Smart meeting';
  display_name text := 'เลขานุการ';
  unit_name text := 'สำนักงาน';
  auth_user uuid;
  person uuid;
  org uuid;
  chosen_unit uuid;
  chosen_unit_name text;
  matches bigint;
  identity_disabled timestamptz;
  profile_disabled timestamptz;
  membership public.organization_memberships%rowtype;
begin
  -- Serialize setup with provisioning, revocation and identity changes.
  perform 1 from private.identity_authorization_guard where id = 1 for update;
  if not found then raise exception 'IDENTITY_GUARD_MISSING'; end if;
  -- Do not repeat the placeholder in validation: editor Replace All must not invalidate a real email.
  if target_email is null or position('@' in btrim(target_email)) < 2 then
    raise exception 'TARGET_EMAIL_REQUIRED: set target_email to the email used to sign in';
  end if;
  select count(*) into matches from auth.users where lower(email) = lower(btrim(target_email));
  if matches <> 1 then raise exception 'AUTH_EMAIL_MUST_MATCH_EXACTLY_ONE_USER (found %)', matches; end if;
  select id into auth_user from auth.users where lower(email) = lower(btrim(target_email));
  select i.profile_id, i.disabled_at, p.disabled_at into person, identity_disabled, profile_disabled
    from public.auth_identities i join public.profiles p on p.id = i.profile_id
    where i.auth_user_id = auth_user;
  if identity_disabled is not null or profile_disabled is not null then
    raise exception 'DISABLED_IDENTITY_OR_PROFILE_REQUIRES_ADMIN_REVIEW';
  end if;

  if target_organization_id is not null then
    select id into org from public.organizations where id = target_organization_id and is_active for share;
    if org is null then raise exception 'TARGET_ORGANIZATION_NOT_FOUND_OR_INACTIVE'; end if;
  else
    select count(*) into matches from public.organizations;
    if matches > 1 then raise exception 'MULTIPLE_ORGANIZATIONS_SET_TARGET_ORGANIZATION_ID'; end if;
    if matches = 1 then
      select id into org from public.organizations where is_active for share;
      if org is null then raise exception 'EXISTING_ORGANIZATION_INACTIVE'; end if;
    end if;
  end if;

  if org is null then
    -- Bootstrap only when the entire project has no organizations; never because membership is missing.
    org := private.bootstrap_workspace(auth_user, organization_name, display_name, unit_name, array['secretary']::text[]);
    select profile_id into person from public.auth_identities where auth_user_id = auth_user;
  else
    perform 1 from private.authorization_guards where organization_id = org for update;
    if not found then raise exception 'ORGANIZATION_GUARD_MISSING'; end if;
    select * into membership from public.organization_memberships where organization_id = org and profile_id = person;
    if found then
      -- Do not restore suspended/revoked access or extend a scheduled membership.
      if membership.status <> 'active' or membership.revoked_at is not null
        or membership.valid_to is not null or membership.valid_from > statement_timestamp() then
        raise exception 'EXISTING_MEMBERSHIP_REQUIRES_ADMIN_REVIEW';
      end if;
      select id, name_th into chosen_unit, chosen_unit_name from public.organization_units
        where organization_id = org and id = membership.unit_id and is_active;
      if chosen_unit is null then raise exception 'MEMBERSHIP_UNIT_MISSING_OR_INACTIVE'; end if;
    else
      select id, name_th into chosen_unit, chosen_unit_name from public.organization_units
        where organization_id = org and name_th = unit_name and is_active;
      if chosen_unit is null then
        if exists(select 1 from public.organization_units where organization_id = org and name_th = unit_name) then
          raise exception 'CONFIGURED_UNIT_INACTIVE';
        end if;
        select count(*) into matches from public.organization_units where organization_id = org and is_active;
        if matches <> 1 then raise exception 'EXISTING_ACTIVE_UNIT_REQUIRED_SET_UNIT_NAME'; end if;
        select id, name_th into chosen_unit, chosen_unit_name from public.organization_units where organization_id = org and is_active;
      end if;
    end if;

    if exists(select 1 from public.access_grants where organization_id = org and profile_id = person
      and role_code = 'secretary' and revoked_at is null and valid_from <= statement_timestamp()
      and (valid_to is null or valid_to > statement_timestamp())) then
      -- Already authorized: retain existing expiry, membership and unit without calling provision_member.
      if membership.id is null then raise exception 'SECRETARY_GRANT_WITHOUT_MEMBERSHIP_REQUIRES_ADMIN_REVIEW'; end if;
    elsif exists(select 1 from public.access_grants where organization_id = org and profile_id = person and role_code = 'secretary') then
      raise exception 'EXISTING_SECRETARY_GRANT_REQUIRES_ADMIN_REVIEW';
    else
      person := private.provision_member(org, auth_user, display_name, chosen_unit_name, array['secretary']::text[]);
    end if;
  end if;

  create temporary table setup_secretary_result (
    organization_id uuid, profile_id uuid, auth_user_id uuid
  ) on commit preserve rows;
  insert into pg_temp.setup_secretary_result values (org, person, auth_user);
end
$$;
commit;

-- ผลหลัง commit: ใช้ organization_id นี้หากตั้ง NEXT_PUBLIC_SUPABASE_ORGANIZATION_ID
select r.organization_id, o.name_th as organization_name, r.profile_id,
  (private.active_member(r.organization_id, r.profile_id)
    and exists(select 1 from public.auth_identities i join public.profiles p on p.id = i.profile_id
      where i.auth_user_id = r.auth_user_id and i.profile_id = r.profile_id and i.disabled_at is null and p.disabled_at is null)
    and exists(select 1 from public.access_grants g where g.organization_id = r.organization_id and g.profile_id = r.profile_id
      and g.role_code = 'secretary' and g.revoked_at is null and g.valid_from <= statement_timestamp()
      and (g.valid_to is null or g.valid_to > statement_timestamp()))) as secretary_access
from pg_temp.setup_secretary_result r join public.organizations o on o.id = r.organization_id;
