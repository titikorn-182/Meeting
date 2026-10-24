import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { bangkokToday, isWorkspaceSnapshot, WorkspaceError } from './workspace';
import { assertSameOrigin, mapDatabaseError, parseWorkspaceCommand } from './workspace-validation';

const uuid = '11111111-1111-4111-8111-111111111111';
const envelope = (operation: string, payload: object) => ({ organizationId: uuid, idempotencyKey: uuid, operation, payload });
const fails = (value: unknown, code = 'VALIDATION_FAILED') => assert.throws(() => parseWorkspaceCommand(value), e => e instanceof WorkspaceError && e.code === code);

test('command boundary cannot forward forged identity, role, timestamps or original deadlines', () => {
  const parsed = parseWorkspaceCommand(envelope('transition_task', { id: uuid, expectedVersion: 4, status: 'accepted', note: 'ผ่าน', criterionResults: [true], actorId: uuid, role: 'executive', acceptedAt: '2000-01-01', originalDueDate: '2099-01-01' }));
  assert.deepEqual(parsed.payload, { id: uuid, expectedVersion: 4, status: 'accepted', note: 'ผ่าน', criterionResults: [true] });
});
test('review results preserve checked/failed criteria and acceptance requires every checked criterion', () => {
  fails(envelope('transition_task', { id: uuid, expectedVersion: 1, status: 'accepted', note: 'ผ่าน' }));
  fails(envelope('transition_task', { id: uuid, expectedVersion: 1, status: 'accepted', note: 'ผ่าน', criterionResults: [true, false] }));
  const returned = parseWorkspaceCommand(envelope('transition_task', { id: uuid, expectedVersion: 1, status: 'revision', note: 'แก้ข้อสอง', criterionResults: [true, false] }));
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
  const payload = { title: 'ประชุม', number: '1/2569', date: '2026-10-25', time: '09:30', location: 'ห้องประชุม', committee: 'กรรมการ', status: 'scheduled', agenda: [{ id: 'client-id', number: '1', title: 'เรื่องแจ้ง', resolutionIds: [uuid] }] };
  assert.deepEqual(parseWorkspaceCommand(envelope('add_meeting', payload)).payload.agenda, [{ number: '1', title: 'เรื่องแจ้ง' }]);
  fails(envelope('add_meeting', { ...payload, agenda: [...payload.agenda, ...payload.agenda] }));
});
test('evidence is an immutable link record; executable/credential URLs and pretend file uploads are rejected', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,hello', 'https://user:secret@example.org']) fails(envelope('add_evidence', { id: uuid, expectedVersion: 1, evidence: { kind: 'link', name: 'หลักฐาน', url } }));
  fails(envelope('add_evidence', { id: uuid, expectedVersion: 1, evidence: { kind: 'file', name: 'file.pdf', url: 'blob:test' } }), 'FEATURE_NOT_AVAILABLE');
  const result = parseWorkspaceCommand(envelope('add_evidence', { id: uuid, expectedVersion: 1, evidence: { kind: 'link', name: 'หลักฐาน', url: 'https://example.org/doc' } }));
  assert.equal((result.payload.evidence as { url: string }).url, 'https://example.org/doc');
});
test('date-only deadlines are validated as civil dates, including leap-year and month boundaries', () => {
  for (const proposedValue of ['2026-02-29', '2026-11-31', '2026-10-31T00:00:00Z']) fails(envelope('create_change_request', { taskId: uuid, expectedVersion: 1, type: 'deadline', reason: 'ทดสอบ', proposedValue }));
  const parsed = parseWorkspaceCommand(envelope('create_change_request', { taskId: uuid, expectedVersion: 1, type: 'deadline', reason: 'ทดสอบ', proposedValue: '2028-02-29' }));
  assert.equal(parsed.payload.proposedValue, '2028-02-29');
  assert.equal(bangkokToday(new Date('2026-10-24T17:00:00Z')), '2026-10-25');
});
test('write API rejects cross-origin and missing-origin requests', () => {
  assert.doesNotThrow(() => assertSameOrigin(new Request('https://meeting.example/api/workspace', { headers: { origin: 'https://meeting.example' } })));
  for (const origin of [undefined, 'https://attacker.example', 'null']) assert.throws(() => assertSameOrigin(new Request('https://meeting.example/api/workspace', { headers: origin ? { origin } : {} })), e => e instanceof WorkspaceError && e.status === 403);
});
test('database exceptions map to safe actionable errors without SQL or raw messages', () => {
  assert.equal(mapDatabaseError({ code: 'P0001', message: 'STALE_VERSION private.secret_table' }).code, 'STALE_VERSION');
  assert.equal(mapDatabaseError({ code: 'PGRST202', message: 'secret' }).code, 'SCHEMA_NOT_READY');
  assert.equal(mapDatabaseError({ code: '42501' }).status, 403);
  assert.equal(mapDatabaseError({ code: '42501', message: 'NO_MEMBERSHIP' }).code, 'NO_MEMBERSHIP');
  assert.equal(mapDatabaseError({ code: '42501', message: 'SELF_REVIEW_NOT_ALLOWED' }).code, 'SELF_REVIEW_NOT_ALLOWED');
  assert.ok(!mapDatabaseError({ message: 'password=do-not-print' }).message.includes('password'));
});
test('connected state must include its signed-in user, organization and directory, never assume demo fallback', () => {
  assert.equal(isWorkspaceSnapshot(null), false);
  assert.equal(isWorkspaceSnapshot({ state: {} }), false);
  const state = { resolutions: [], tasks: [], meetings: [], changes: [], notifications: [], audit: [], currentUserId: uuid, settings: {} };
  const valid = { state, users: [{ id: uuid }], units: [], eligibleOwners: [], organization: { id: uuid, name: 'องค์กร' }, permissions: [], roles: [] };
  assert.equal(isWorkspaceSnapshot(valid), true);
  assert.equal(isWorkspaceSnapshot({ ...valid, users: [] }), false);
});
