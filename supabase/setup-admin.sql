-- Run after migrations 001-005 in Supabase SQL Editor as database administrator.
-- Replace YOUR_LOGIN_EMAIL and YOUR_ORGANIZATION_UUID explicitly.
-- The Auth account and active organization membership must already exist.
-- This never creates an organization or revives suspended/revoked access.
-- Repeating this script for an existing admin does not increase their version.
drop table if exists pg_temp.setup_admin_result;
begin;
create temporary table setup_admin_result (access jsonb) on commit preserve rows;
insert into pg_temp.setup_admin_result(access)
select private.bootstrap_admin('YOUR_LOGIN_EMAIL', 'YOUR_ORGANIZATION_UUID'::uuid);
commit;
select access->>'organizationId' as organization_id,
       access->>'profileId' as profile_id,
       access->>'role' as access_role,
       access->'pages' as allowed_pages
from pg_temp.setup_admin_result;
