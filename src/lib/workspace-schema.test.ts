import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_ROLE_PAGES } from './access-control';
import { initialState, users } from '../demo/fixtures/workspace';
import { decodeWorkspaceSnapshot, isNormalizedWorkspaceSnapshot } from './workspace-schema';
import {
  decodeCommandResult,
  errorResponseSchema,
  type CommandPayloads,
} from './workspace-commands';

function fixture() {
  return structuredClone({
    state: initialState,
    users,
    eligibleOwners: users.map(({ id, name, unit }) => ({ id, name, unit })),
    units: ['Test'],
    organization: { id: 'org-test', name: 'Test' },
    permissions: [],
    roles: ['secretary'],
    access: {
      role: 'admin',
      pages: DEFAULT_ROLE_PAGES.admin,
      policies: DEFAULT_ROLE_PAGES,
      policyVersion: 1,
      members: { [initialState.currentUserId]: { role: 'admin', version: 0 } },
    },
  });
}
test('full workspace validates every populated collection without modifying the source', () => {
  const value = fixture();
  const before = structuredClone(value);
  const decoded = decodeWorkspaceSnapshot(value);
  assert.ok(decoded);
  assert.ok(isNormalizedWorkspaceSnapshot(decoded));
  assert.deepEqual(value, before);
});
for (const key of [
  'tasks',
  'resolutions',
  'meetings',
  'changes',
  'notifications',
  'audit',
] as const) {
  test(`rejects malformed ${key} entries without throwing`, () => {
    for (const item of [null, 123, 'bad', [], {}]) {
      const value = fixture();
      const invalid = { ...value, state: { ...value.state, [key]: [item] } };
      assert.equal(decodeWorkspaceSnapshot(invalid), null);
      assert.equal(isNormalizedWorkspaceSnapshot(invalid), false);
    }
  });
}
test('rejects null directory entries, invalid roles, settings and member records', () => {
  const value = fixture();
  for (const patch of [
    { users: [null] },
    { eligibleOwners: [null] },
    { roles: ['superadmin'] },
    { users: [{ ...value.users[0], name: 123 }] },
    { access: { ...value.access, members: { [initialState.currentUserId]: null } } },
    { state: { ...value.state, settings: { ...value.state.settings, emailNotifications: 'yes' } } },
    { state: { ...value.state, activeRole: 'admin' } },
  ])
    assert.equal(decodeWorkspaceSnapshot({ ...value, ...patch }), null);
});
test('rejects invalid nested evidence, agenda and numeric progress', () => {
  for (const patch of [
    { evidence: [null] },
    { updates: [null] },
    { criteria: [123] },
    { progress: 101 },
    { progress: NaN },
    { status: 'unknown' },
    { rowVersion: 0 },
  ]) {
    const value = fixture();
    assert.equal(
      decodeWorkspaceSnapshot({
        ...value,
        state: { ...value.state, tasks: [{ ...value.state.tasks[0], ...patch }] },
      }),
      null,
    );
  }
  const value = fixture();
  assert.equal(
    decodeWorkspaceSnapshot({
      ...value,
      state: { ...value.state, meetings: [{ ...value.state.meetings[0], agenda: [null] }] },
    }),
    null,
  );
});
test('does not treat malformed full details as a permitted summary', () => {
  const value = fixture();
  const { title, id, code, status } = value.state.resolutions[0];
  assert.equal(
    decodeWorkspaceSnapshot({
      ...value,
      state: {
        ...value.state,
        resolutions: [{ id, code, title, status, partialContext: true, executionAuthorized: true }],
      },
    }),
    null,
  );
  assert.equal(
    decodeWorkspaceSnapshot({ ...value, state: { ...value.state, settings: {} } }),
    null,
  );
});
test('staff projection accepts only appropriate wire shapes and produces safe screen values', () => {
  const value = fixture();
  const resolution = value.state.resolutions[0];
  const wire = {
    ...value,
    access: {
      ...value.access,
      role: 'staff',
      pages: DEFAULT_ROLE_PAGES.staff,
      members: { [initialState.currentUserId]: { role: 'staff', version: 0 } },
    },
    state: {
      ...value.state,
      settings: {},
      meetings: [],
      resolutions: [
        {
          id: resolution.id,
          title: resolution.title,
          code: resolution.code,
          status: resolution.status,
          partialContext: true,
          executionAuthorized: true,
        },
      ],
    },
  };
  const decoded = decodeWorkspaceSnapshot(wire);
  assert.ok(decoded);
  assert.ok(isNormalizedWorkspaceSnapshot(decoded));
  assert.deepEqual(decoded.state.resolutions[0].closureCriteria, []);
  assert.equal(decoded.state.resolutions[0].partialContext, true);
  assert.equal(
    decodeWorkspaceSnapshot({ ...wire, state: { ...wire.state, settings: { reviewDays: 'bad' } } }),
    null,
  );
});
test('unknown future fields do not break compatibility, but required fields cannot disappear', () => {
  const value = fixture();
  assert.ok(decodeWorkspaceSnapshot({ ...value, future: true }));
  assert.equal(decodeWorkspaceSnapshot({ ...value, organization: {} }), null);
  assert.equal(decodeWorkspaceSnapshot({ ...value, users: [] }), null);
});
test('validates command-specific RPC results, including legitimate empty mark-all response', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  assert.deepEqual(decodeCommandResult('mark_all_read', {}), {});
  assert.deepEqual(decodeCommandResult('add_personnel', { id, status: 'pending' }), {
    id,
    status: 'pending',
  });
  assert.deepEqual(decodeCommandResult('set_member_role', { id, version: 2 }), { id, version: 2 });
  assert.deepEqual(decodeCommandResult('set_role_pages', { policyVersion: 3 }), {
    policyVersion: 3,
  });
  for (const malformed of [null, [], {}, { id: 1 }, { id: '' }])
    assert.equal(decodeCommandResult('add_task', malformed), null);
  assert.equal(decodeCommandResult('set_member_role', { id, version: -1 }), null);
  assert.equal(decodeCommandResult('set_role_pages', { version: 2 }), null);
  assert.equal(decodeCommandResult('add_personnel', { id }), null);
});
test('malformed error envelopes cannot throw or expose arbitrary server text', () => {
  for (const malformed of [null, [], {}, { error: null }, { error: { code: 500 } }])
    assert.equal(errorResponseSchema.safeParse(malformed).success, false);
  assert.deepEqual(
    errorResponseSchema.parse({ error: { code: 'FORBIDDEN', message: 'private SQL details' } }),
    { error: { code: 'FORBIDDEN' } },
  );
});

// Compile-time regressions: these must remain errors when typecheck runs.
function typeContracts() {
  // @ts-expect-error Missing required names and unit must fail at compile time.
  const personnel: CommandPayloads['add_personnel'] = { email: 'test@example.org', role: 'admin' };
  const progress: CommandPayloads['update_progress'] = {
    id: 'id',
    expectedVersion: 1,
    // @ts-expect-error A string progress value must fail at compile time.
    progress: '50',
    note: '',
  };
  return { personnel, progress };
}
void typeContracts;
