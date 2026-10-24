import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, users } from './mock-data';
import type { Actor, Task } from './types';
import { approveDeadlineChange, canCloseResolution, daysUntil, formatThaiDate, getDashboardMetrics, getResolutionProgress, isOverdue, nextDisplayCode, reconcileResolutionStatus, validateTaskTransition } from './workflow';

const owner: Actor = { role: 'owner', userId: 'u-thanaphorn' };
const reviewer: Actor = { role: 'reviewer', userId: 'u-somchai' };
const executive: Actor = { role: 'executive', userId: 'u-anan' };
const seededTask = (id: string): Task => structuredClone(initialState.tasks.find((task) => task.id === id)!);

test('date-only deadlines stay open throughout their Thai calendar day', () => {
  const task = { ...seededTask('t13'), dueDate: '2026-10-24' };
  assert.equal(daysUntil(task.dueDate, '2026-10-24T16:59:59.999Z'), 0);
  assert.equal(isOverdue(task, '2026-10-24T16:59:59.999Z'), false);
  assert.equal(isOverdue(task, '2026-10-24T17:00:00Z'), true);
  assert.equal(daysUntil('2026-11-01', '2026-10-24'), 8);
});

test('missing and impossible dates do not become overdue or valid deadlines', () => {
  assert.equal(daysUntil(undefined), null);
  assert.equal(daysUntil('2026-02-30'), null);
  assert.equal(formatThaiDate('not-a-date'), '—');
  assert.match(formatThaiDate('2026-10-24'), /2569/);
});

test('submitted late work stays overdue, while accepted and cancelled work leave the current backlog', () => {
  assert.equal(isOverdue(seededTask('t06')), true);
  assert.equal(isOverdue(seededTask('t01')), false);
  assert.equal(isOverdue(seededTask('t20')), false);
});

test('100 percent progress cannot bypass evidence, review or resolution closure', () => {
  const task = { ...seededTask('t02'), progress: 100, evidence: [] };
  assert.equal(getResolutionProgress(task.resolutionId, [task]), 100);
  assert.equal(validateTaskTransition(task, 'submitted', owner).allowed, false);
  assert.equal(validateTaskTransition(task, 'accepted', reviewer).allowed, false);
  assert.equal(canCloseResolution(task.resolutionId, [task]), false);
});

test('closing needs all required tasks accepted and the explicit criteria gate', () => {
  const accepted = seededTask('t01');
  const pending = seededTask('t02');
  assert.equal(canCloseResolution('r01', [accepted, pending]), false);
  assert.equal(canCloseResolution('r01', [accepted, { ...pending, status: 'cancelled' }]), false);
  assert.equal(canCloseResolution('r01', [accepted, { ...pending, required: false }]), true);
  assert.equal(canCloseResolution('r01', [accepted], false), false);
  assert.equal(canCloseResolution('unknown', []), false);
});

test('accepting the last required task readies its parent without closing it or mutating prior state', () => {
  const before = structuredClone(initialState);
  before.changes = before.changes.filter((change) => change.taskId !== 't03');
  before.tasks = before.tasks.map((task) => task.resolutionId === 'r01' ? { ...task, status: 'accepted' as const } : task);
  const after = reconcileResolutionStatus(before, 'r01');
  assert.equal(before.resolutions.find((item) => item.id === 'r01')!.status, 'open');
  assert.equal(after.resolutions.find((item) => item.id === 'r01')!.status, 'pending_close');
  assert.equal(after.resolutions.find((item) => item.id === 'r02')!.status, 'closed');
});

test('unresolved changes and newly assigned required work prevent a ready parent from remaining ready', () => {
  const state = structuredClone(initialState);
  state.tasks = state.tasks.map((task) => task.resolutionId === 'r01' ? { ...task, status: 'accepted' as const } : task);
  assert.equal(reconcileResolutionStatus(state, 'r01').resolutions.find((item) => item.id === 'r01')!.status, 'open');
  state.changes = state.changes.map((change) => change.id === 'c01' ? { ...change, status: 'rejected' as const } : change);
  const ready = reconcileResolutionStatus(state, 'r01');
  assert.equal(ready.resolutions.find((item) => item.id === 'r01')!.status, 'pending_close');
  const newWork = { ...ready, tasks: [...ready.tasks, { ...seededTask('t02'), id: 'new-task', status: 'assigned' as const, progress: 0 }] };
  assert.equal(reconcileResolutionStatus(newWork, 'r01').resolutions.find((item) => item.id === 'r01')!.status, 'open');
});

test('completed recurring rounds never ready the parent, and acknowledgement/closed parents keep their lifecycle', () => {
  const state = structuredClone(initialState);
  state.tasks = state.tasks.map((task) => task.resolutionId === 'r10' ? { ...task, status: 'accepted' as const } : task);
  assert.equal(reconcileResolutionStatus(state, 'r10').resolutions.find((item) => item.id === 'r10')!.status, 'open');
  assert.equal(reconcileResolutionStatus(state, 'r12').resolutions.find((item) => item.id === 'r12')!.status, 'acknowledged');
  assert.equal(reconcileResolutionStatus(state, 'r02').resolutions.find((item) => item.id === 'r02')!.status, 'closed');
});

test('new display codes follow seed formats and stay unique across gaps and legacy persisted codes', () => {
  assert.equal(nextDisplayCode('resolution', initialState.resolutions.map((item) => item.code)), 'มติ 2569/013');
  assert.equal(nextDisplayCode('task', initialState.tasks.map((item) => item.code)), 'งาน-021');
  assert.equal(nextDisplayCode('change', initialState.changes.map((item) => item.code)), 'CR-2569-016');
  assert.equal(nextDisplayCode('resolution', ['มติ 2569/001', 'มติ 013/2569']), 'มติ 2569/014');
  assert.equal(nextDisplayCode('task', ['งาน-001', 'T-024']), 'งาน-025');
  assert.equal(nextDisplayCode('change', ['CR-2569-014', 'CR-020/2569']), 'CR-2569-021');
});

test('owners acknowledge first, and another owner cannot act on their work', () => {
  const assigned: Task = { ...seededTask('t14'), acknowledgedAt: undefined };
  assert.equal(validateTaskTransition(assigned, 'in_progress', owner).allowed, false);
  assigned.acknowledgedAt = '2026-10-24T09:00:00+07:00';
  assert.equal(validateTaskTransition(assigned, 'in_progress', owner).allowed, true);
  assert.equal(validateTaskTransition(assigned, 'in_progress', { role: 'owner', userId: 'u-nattapong' }).allowed, false);
});

test('assigned reviewer can accept a submission, but self-review and unrelated reviewer are denied', () => {
  const task = seededTask('t06');
  assert.equal(validateTaskTransition(task, 'accepted', reviewer).allowed, true);
  assert.equal(validateTaskTransition(task, 'accepted', { role: 'reviewer', userId: task.ownerId }).allowed, false);
  assert.equal(validateTaskTransition(task, 'accepted', { role: 'reviewer', userId: 'unassigned-reviewer' }).allowed, false);
  assert.equal(validateTaskTransition(task, 'accepted', executive).allowed, false);
});

test('an executive reviews only work explicitly assigned to them, and never their own work', () => {
  const task = { ...seededTask('t06'), reviewerId: executive.userId };
  assert.equal(validateTaskTransition(task, 'accepted', executive).allowed, true);
  assert.equal(validateTaskTransition(task, 'revision', executive).allowed, true);
  assert.equal(validateTaskTransition(task, 'accepted', reviewer).allowed, false);
  assert.equal(validateTaskTransition({ ...task, ownerId: executive.userId }, 'accepted', executive).allowed, false);
});

test('terminal task rounds cannot silently reopen or be changed into success', () => {
  assert.equal(validateTaskTransition(seededTask('t20'), 'accepted', reviewer).allowed, false);
  assert.equal(validateTaskTransition(seededTask('t01'), 'in_progress', owner).allowed, false);
});

test('deadline approval updates only current due date and records a decision without mutating input', () => {
  const before = structuredClone(initialState);
  const after = approveDeadlineChange(before, 'c01', executive, '2026-10-24T10:00:00+07:00');
  const task = after.tasks.find((item) => item.id === 't03')!;
  assert.equal(task.originalDueDate, '2026-10-23');
  assert.equal(task.dueDate, '2026-10-30');
  assert.equal(before.tasks.find((item) => item.id === 't03')!.dueDate, '2026-10-23');
  assert.equal(before.changes.find((item) => item.id === 'c01')!.status, 'pending');
  assert.equal(after.changes.find((item) => item.id === 'c01')!.status, 'approved');
  assert.equal(after.audit.length, before.audit.length + 1);
  assert.throws(() => approveDeadlineChange(after, 'c01', executive), /รอพิจารณา/);
});

test('pending requests leave deadlines unchanged; self-approval, stale and invalid proposals are rejected', () => {
  assert.equal(initialState.tasks.find((item) => item.id === 't03')!.dueDate, '2026-10-23');
  assert.throws(() => approveDeadlineChange(initialState, 'c01', owner), /ไม่มีสิทธิ/);
  assert.throws(() => approveDeadlineChange(initialState, 'c01', { role: 'executive', userId: owner.userId }), /ตนเอง/);
  const stale = structuredClone(initialState);
  stale.tasks.find((item) => item.id === 't03')!.dueDate = '2026-10-26';
  assert.throws(() => approveDeadlineChange(stale, 'c01', executive), /เปลี่ยนไปแล้ว/);
  const invalid = structuredClone(initialState);
  invalid.changes.find((item) => item.id === 'c01')!.proposedValue = '2026-02-30';
  assert.throws(() => approveDeadlineChange(invalid, 'c01', executive), /วันที่ถูกต้อง/);
});

test('dashboard backlog separates terminal work and does not treat cancellation as completion', () => {
  const metrics = getDashboardMetrics(initialState);
  assert.equal(metrics.totalTasks, 20);
  assert.equal(metrics.completedTasks, 5);
  assert.equal(metrics.activeTasks, 14);
  assert.equal(metrics.overdueTasks, 3);
  assert.equal(metrics.pendingReviewTasks, 2);
  assert.equal(metrics.completionRate, 25);
  assert.equal(metrics.closedResolutions, 2);
});

test('synthetic records have valid relationships and accepted evidence precedes acceptance', () => {
  assert.ok(initialState.resolutions.length >= 12);
  assert.ok(initialState.meetings.length >= 4);
  assert.ok(users.length >= 5);
  for (const task of initialState.tasks) {
    assert.ok(initialState.resolutions.some((resolution) => resolution.id === task.resolutionId));
    assert.ok(users.some((user) => user.id === task.ownerId));
    assert.ok(users.some((user) => user.id === task.reviewerId));
    if (task.status === 'accepted') {
      assert.ok(task.evidence.length > 0);
      assert.ok(Date.parse(task.submittedAt!) <= Date.parse(task.acceptedAt!));
    }
  }
  for (const change of initialState.changes.filter((item) => item.status === 'pending')) {
    const task = initialState.tasks.find((item) => item.id === change.taskId)!;
    const currentValue = change.type === 'deadline' ? task.dueDate : change.type === 'owner' ? task.ownerId : task.description;
    assert.equal(change.originalValue, currentValue, `seeded request ${change.id} must be reviewable, not stale`);
  }
});
