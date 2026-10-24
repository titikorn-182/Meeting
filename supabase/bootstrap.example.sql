-- Run only in Supabase SQL Editor / an administrator connection AFTER the 4 migrations.
-- Create actual users first in Authentication > Users. Replace UUID placeholders below.
-- This file is an example, not a seed: it is never executed by the app or test harness.

-- 1. Bootstrap one organization and its secretary. Save the returned organization UUID.
select private.bootstrap_workspace(
  '00000000-0000-0000-0000-000000000001'::uuid, -- secretary Auth user UUID
  'ชื่อหน่วยงานเจ้าของระบบ',
  'ชื่อเลขานุการ',
  'สำนักงาน',
  array['secretary']::text[]
);

-- 2. Provision members deliberately. Use distinct users for owner and reviewer.
select private.provision_member(
  '00000000-0000-0000-0000-000000000010'::uuid, -- organization UUID returned above
  '00000000-0000-0000-0000-000000000002'::uuid, -- actual owner Auth user UUID
  'ชื่อผู้รับผิดชอบงาน', 'สำนักงาน', array['owner']::text[]
);
select private.provision_member(
  '00000000-0000-0000-0000-000000000010'::uuid,
  '00000000-0000-0000-0000-000000000003'::uuid, -- actual reviewer Auth user UUID
  'ชื่อผู้ตรวจ', 'สำนักงาน', array['reviewer']::text[]
);
select private.provision_member(
  '00000000-0000-0000-0000-000000000010'::uuid,
  '00000000-0000-0000-0000-000000000004'::uuid, -- actual authorized decision maker Auth user UUID
  'ชื่อผู้มีอำนาจอนุมัติ', 'สำนักงาน', array['executive']::text[]
);

-- 3. Optional: create additional units before provisioning their members.
-- insert into public.organization_units(organization_id,code,name_th)
-- values ('YOUR_ORGANIZATION_UUID'::uuid,'academic','ฝ่ายวิชาการ');

-- Role grants are additive. To grant more than one actual role use an explicit array:
-- select private.provision_member('ORG_UUID','AUTH_USER_UUID','ชื่อ','สำนักงาน',array['secretary','executive']);
-- A person with both roles still cannot approve their own change request or review work they contributed to.

-- 4. Revoke access with the guard protocol. Retain history and assignments.
-- select private.revoke_member('ORG_UUID'::uuid,'PROFILE_UUID'::uuid,'เหตุผลที่ถอนสิทธิ');
-- select private.disable_identity('AUTH_USER_UUID'::uuid,'เหตุผลที่ปิดบัญชี');

-- Provisioning helpers are not callable by anon/authenticated clients. Never expose an admin key to the browser.
