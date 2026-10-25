import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { bangkokToday, isWorkspaceSnapshot, WorkspaceError } from './workspace';
import { assertSameOrigin, mapDatabaseError, parseWorkspaceCommand } from './workspace-validation';

const uuid = '11111111-1111-4111-8111-111111111111';
const envelope = (operation: string, payload: object) => ({
  organizationId: uuid,
  idempotencyKey: uuid,
  operation,
  payload,
});
const fails = (value: unknown, code = 'VALIDATION_FAILED') =>
  assert.throws(
    () => parseWorkspaceCommand(value),
    (e) => e instanceof WorkspaceError && e.code === code,
  );

test('command boundary cannot forward forged identity, role, timestamps or original deadlines', () => {
  const parsed = parseWorkspaceCommand(
    envelope('transition_task', {
      id: uuid,
      expectedVersion: 4,
      status: 'accepted',
      note: 'ผ่าน',
      criterionResults: [true],
      actorId: uuid,
      role: 'executive',
      acceptedAt: '2000-01-01',
      originalDueDate: '2099-01-01',
    }),
  );
  assert.deepEqual(parsed.payload, {
    id: uuid,
    expectedVersion: 4,
    status: 'accepted',
    note: 'ผ่าน',
    criterionResults: [true],
  });
});
test('review results preserve checked/failed criteria and acceptance requires every checked criterion', () => {
  fails(
    envelope('transition_task', { id: uuid, expectedVersion: 1, status: 'accepted', note: 'ผ่าน' }),
  );
  fails(
    envelope('transition_task', {
      id: uuid,
      expectedVersion: 1,
      status: 'accepted',
      note: 'ผ่าน',
      criterionResults: [true, false],
    }),
  );
  const returned = parseWorkspaceCommand(
    envelope('transition_task', {
      id: uuid,
      expectedVersion: 1,
      status: 'revision',
      note: 'แก้ข้อสอง',
      criterionResults: [true, false],
    }),
  );
  assert.equal(returned.operation, 'transition_task');
  if (returned.operation !== 'transition_task') throw new Error('Wrong operation');
  assert.deepEqual(returned.payload.criterionResults, [true, false]);
});
test('targeted commands require a server row version and real UUIDs', () => {
  fails(envelope('acknowledge_task', { id: uuid }));
  fails(envelope('acknowledge_task', { id: 'u-admin', expectedVersion: 1 }));
  fails(envelope('acknowledge_task', { id: uuid, expectedVersion: 0 }));
  fails(envelope('delete_everything', {}));
  fails({ ...envelope('mark_all_read', {}), organizationId: 'org-other' });
});
test('creating a meeting preserves typed agenda rows and rejects duplicate agenda numbers', () => {
  const payload = {
    title: 'ประชุม',
    number: '1/2569',
    date: '2026-10-25',
    time: '09:30',
    location: 'ห้องประชุม',
    committee: 'กรรมการ',
    status: 'scheduled',
    agenda: [{ id: 'client-id', number: '1', title: 'เรื่องแจ้ง', resolutionIds: [uuid] }],
  };
  const meeting = parseWorkspaceCommand(envelope('add_meeting', payload));
  if (meeting.operation !== 'add_meeting') throw new Error('Wrong operation');
  assert.deepEqual(meeting.payload.agenda, [{ number: '1', title: 'เรื่องแจ้ง' }]);
  fails(envelope('add_meeting', { ...payload, agenda: [...payload.agenda, ...payload.agenda] }));
});
test('evidence is an immutable link record; executable/credential URLs and pretend file uploads are rejected', () => {
  for (const url of [
    'javascript:alert(1)',
    'data:text/html,hello',
    'https://user:secret@example.org',
  ])
    fails(
      envelope('add_evidence', {
        id: uuid,
        expectedVersion: 1,
        evidence: { kind: 'link', name: 'หลักฐาน', url },
      }),
    );
  fails(
    envelope('add_evidence', {
      id: uuid,
      expectedVersion: 1,
      evidence: { kind: 'file', name: 'file.pdf', url: 'blob:test' },
    }),
    'FEATURE_NOT_AVAILABLE',
  );
  const result = parseWorkspaceCommand(
    envelope('add_evidence', {
      id: uuid,
      expectedVersion: 1,
      evidence: { kind: 'link', name: 'หลักฐาน', url: 'https://example.org/doc' },
    }),
  );
  if (result.operation !== 'add_evidence') throw new Error('Wrong operation');
  assert.equal(result.payload.evidence.url, 'https://example.org/doc');
});
test('date-only deadlines are validated as civil dates, including leap-year and month boundaries', () => {
  for (const proposedValue of ['2026-02-29', '2026-11-31', '2026-10-31T00:00:00Z'])
    fails(
      envelope('create_change_request', {
        taskId: uuid,
        expectedVersion: 1,
        type: 'deadline',
        reason: 'ทดสอบ',
        proposedValue,
      }),
    );
  const parsed = parseWorkspaceCommand(
    envelope('create_change_request', {
      taskId: uuid,
      expectedVersion: 1,
      type: 'deadline',
      reason: 'ทดสอบ',
      proposedValue: '2028-02-29',
    }),
  );
  if (parsed.operation !== 'create_change_request') throw new Error('Wrong operation');
  assert.equal(parsed.payload.proposedValue, '2028-02-29');
  assert.equal(bangkokToday(new Date('2026-10-24T17:00:00Z')), '2026-10-25');
});
test('write API rejects cross-origin and missing-origin requests', () => {
  assert.doesNotThrow(() =>
    assertSameOrigin(
      new Request('https://meeting.example/api/workspace', {
        headers: { origin: 'https://meeting.example' },
      }),
    ),
  );
  for (const origin of [undefined, 'https://attacker.example', 'null'])
    assert.throws(
      () =>
        assertSameOrigin(
          new Request('https://meeting.example/api/workspace', {
            headers: origin ? { origin } : {},
          }),
        ),
      (e) => e instanceof WorkspaceError && e.status === 403,
    );
});
test('database exceptions map to safe actionable errors without SQL or raw messages', () => {
  assert.equal(
    mapDatabaseError({ code: 'P0001', message: 'STALE_VERSION private.secret_table' }).code,
    'STALE_VERSION',
  );
  assert.equal(mapDatabaseError({ code: 'PGRST202', message: 'secret' }).code, 'SCHEMA_NOT_READY');
  assert.equal(mapDatabaseError({ code: '42501' }).status, 403);
  assert.equal(mapDatabaseError({ code: '42501', message: 'NO_MEMBERSHIP' }).code, 'NO_MEMBERSHIP');
  assert.equal(
    mapDatabaseError({ code: '42501', message: 'SELF_REVIEW_NOT_ALLOWED' }).code,
    'SELF_REVIEW_NOT_ALLOWED',
  );
  assert.ok(!mapDatabaseError({ message: 'password=do-not-print' }).message.includes('password'));
});
test('connected state must include its signed-in user, organization and directory, never assume demo fallback', () => {
  assert.equal(isWorkspaceSnapshot(null), false);
  assert.equal(isWorkspaceSnapshot({ state: {} }), false);
  const state = {
    resolutions: [],
    tasks: [],
    meetings: [],
    changes: [],
    notifications: [],
    audit: [],
    currentUserId: uuid,
    activeRole: 'owner',
    settings: { reminderDays: [], acknowledgmentDays: 2, reviewDays: 3, emailNotifications: false },
  };
  const access = {
    role: 'staff',
    pages: ['tasks'],
    policies: {
      admin: [
        'dashboard',
        'meetings',
        'resolutions',
        'tasks',
        'reviews',
        'changes',
        'reports',
        'team',
        'settings',
        'notifications',
      ],
      user: [],
      executive: [],
      staff: ['tasks'],
    },
    policyVersion: 1,
    members: { [uuid]: { role: 'staff', version: 0 } },
  };
  const valid = {
    state,
    users: [
      { id: uuid, name: 'Test', initials: 'T', role: 'owner', unit: 'Test', avatarColor: '#fff' },
    ],
    units: [],
    eligibleOwners: [],
    organization: { id: uuid, name: 'องค์กร' },
    permissions: [],
    roles: [],
    access,
  };
  assert.equal(isWorkspaceSnapshot(valid), true);
  assert.equal(isWorkspaceSnapshot({ ...valid, users: [] }), false);
  assert.equal(isWorkspaceSnapshot({ ...valid, access: undefined }), false);
  assert.equal(isWorkspaceSnapshot({ ...valid, access: { ...access, role: 'admin' } }), false);
});

test('member role command accepts version zero but strips caller identity and authority', () => {
  const result = parseWorkspaceCommand(
    envelope('set_member_role', {
      profileId: uuid,
      role: 'admin',
      expectedVersion: 0,
      actorId: uuid,
      organizationId: uuid,
      bypass: true,
    }),
  );
  assert.deepEqual(result.payload, { profileId: uuid, role: 'admin', expectedVersion: 0 });
  for (const role of ['secretary', 'superadmin', 'ADMIN'])
    fails(envelope('set_member_role', { profileId: uuid, role, expectedVersion: 0 }));
  fails(envelope('set_member_role', { profileId: uuid, role: 'admin', expectedVersion: -1 }));
});

test('page policy accepts an explicit no-access policy but rejects Admin edits and Staff broad access', () => {
  assert.deepEqual(
    parseWorkspaceCommand(
      envelope('set_role_pages', { role: 'user', pages: [], expectedVersion: 1 }),
    ).payload,
    { role: 'user', pages: [], expectedVersion: 1 },
  );
  for (const payload of [
    { role: 'admin', pages: [], expectedVersion: 1 },
    { role: 'staff', pages: ['team'], expectedVersion: 1 },
    { role: 'user', pages: ['tasks', 'tasks'], expectedVersion: 1 },
    { role: 'user', pages: ['unknown'], expectedVersion: 1 },
    { role: 'user', pages: ['tasks'], expectedVersion: 0 },
  ])
    fails(envelope('set_role_pages', payload));
});
