import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_ROLE_PAGES,
  WORKSPACE_PAGES,
  canAccessPage,
  isAccessControl,
  landingPath,
  pageForPath,
  permissionsForAccessRole,
  type AccessControl,
} from './access-control';

const access = (role: AccessControl['role']): AccessControl => ({
  role,
  pages: [...DEFAULT_ROLE_PAGES[role]],
  policies: structuredClone(DEFAULT_ROLE_PAGES),
  policyVersion: 1,
  members: { self: { role, version: 0 } },
});
test('new User and Executive accounts require administrator page selection', () => {
  for (const role of ['user', 'executive'] as const) {
    assert.deepEqual(access(role).pages, []);
    assert.equal(canAccessPage(access(role), 'team'), false);
    assert.equal(isAccessControl(access(role)), true);
  }
  assert.deepEqual(
    access('admin').pages,
    WORKSPACE_PAGES.map((page) => page.key),
  );
});
test('Staff lands on personal tasks; role alone cannot enable other pages', () => {
  const staff = access('staff');
  assert.equal(landingPath(staff), '/tasks');
  assert.equal(canAccessPage(staff, 'tasks'), true);
  assert.equal(canAccessPage({ ...staff, pages: ['team'] }, 'team'), false);
  assert.equal(
    isAccessControl({
      ...staff,
      pages: ['team'],
      policies: { ...staff.policies, staff: ['team'] },
    }),
    false,
  );
});
test('route matching handles nested details without prefix-confusion', () => {
  assert.equal(pageForPath('/tasks/abc?tab=evidence'), 'tasks');
  assert.equal(pageForPath('/resolutions/new/'), 'resolutions');
  assert.equal(pageForPath('/team'), 'team');
  assert.equal(pageForPath('/teamwork'), null);
  assert.equal(pageForPath('/'), 'dashboard');
});
test('management payloads cannot promote authority through malformed snapshot fields', () => {
  const admin = access('admin');
  assert.equal(isAccessControl(admin), true);
  assert.equal(isAccessControl({ ...admin, role: 'superadmin' }), false);
  assert.equal(isAccessControl({ ...admin, policyVersion: 0 }), false);
  assert.equal(
    isAccessControl({ ...admin, members: { self: { role: 'admin', version: -1 } } }),
    false,
  );
  assert.equal(isAccessControl({ ...admin, policies: { ...admin.policies, admin: [] } }), false);
});
test('UI action capabilities require both canonical role and enabled action page', () => {
  assert.deepEqual(permissionsForAccessRole('staff', []), []);
  assert.deepEqual(permissionsForAccessRole('staff', ['tasks']), ['task.work']);
  assert(!permissionsForAccessRole('user', ['team', 'settings']).includes('access.manage'));
  assert(!permissionsForAccessRole('user', ['changes']).includes('deadline.approve'));
  assert(permissionsForAccessRole('executive', ['reviews']).includes('submission.review'));
  assert(!permissionsForAccessRole('executive', []).includes('submission.review'));
});
