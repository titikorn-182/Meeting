-- Run after migrations 001-005 in Supabase SQL Editor as database administrator.
-- Replace YOUR_LOGIN_EMAIL and YOUR_ORGANIZATION_UUID explicitly.
-- The Auth account and active organization membership must already exist.
-- This never creates an organization or revives suspended/revoked access.
-- Repeating this script for an existing admin does not increase their version.
-- Run the entire WITH ... SELECT statement together in a new SQL Editor query.
-- One statement grants access and returns its result without temporary tables.
with granted as materialized (
  select private.bootstrap_admin('YOUR_LOGIN_EMAIL', 'YOUR_ORGANIZATION_UUID'::uuid) as access
)
select access->>'organizationId' as organization_id,
       access->>'profileId' as profile_id,
       access->>'role' as access_role,
       access->'pages' as allowed_pages
from granted;
