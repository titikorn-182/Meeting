import assert from 'node:assert/strict';
import test from 'node:test';
import { initialState, DEMO_TODAY } from '../demo/fixtures/workspace';
import { buildTaskIndex, selectReportModel } from './workspace-selectors';
import { getResolutionProgress, isOverdue, formatThaiDate, daysUntil } from './workflow';
import type { Task } from './types';

test('task index preserves counts, progress, ordering and participant deduplication', () => {
  const tasks: Task[] = [
    ...initialState.tasks,
    {
      ...initialState.tasks[0],
      id: 'same-participant',
      reviewerId: initialState.tasks[0].ownerId,
      progress: 150,
    },
    { ...initialState.tasks[0], id: 'negative-progress', progress: -20 },
  ];
  const before = structuredClone(tasks);
  const index = buildTaskIndex(tasks, DEMO_TODAY);
  for (const id of new Set(tasks.map((task) => task.resolutionId))) {
    const expected = tasks.filter((task) => task.resolutionId === id);
    const actual = index.byResolution.get(id)!;
    assert.deepEqual(actual.tasks, expected);
    assert.equal(actual.total, expected.length);
    assert.equal(actual.progress, getResolutionProgress(id, tasks));
    assert.equal(actual.overdue, expected.filter((task) => isOverdue(task, DEMO_TODAY)).length);
    assert.equal(actual.accepted, expected.filter((task) => task.status === 'accepted').length);
  }
  for (const id of new Set(tasks.flatMap((task) => [task.ownerId, task.reviewerId]))) {
    assert.deepEqual(
      index.byParticipant.get(id),
      tasks.filter((task) => task.ownerId === id || task.reviewerId === id),
    );
    const owned = tasks.filter((task) => task.ownerId === id);
    assert.equal(
      index.byOwner.get(id)?.active ?? 0,
      owned.filter((task) => !['accepted', 'cancelled'].includes(task.status)).length,
    );
  }
  for (const [status, count] of Object.entries(index.statusCounts))
    assert.equal(count, tasks.filter((task) => task.status === status).length);
  assert.deepEqual(tasks, before);
});

test('report uses original due date cohort, Thai acceptance day, and retains cancelled denominator', () => {
  const task = initialState.tasks[0];
  const tasks: Task[] = [
    {
      ...task,
      id: 'on-time',
      status: 'accepted',
      originalDueDate: '2026-10-23',
      dueDate: '2026-10-30',
      acceptedAt: '2026-10-23T16:59:59Z',
    },
    {
      ...task,
      id: 'late',
      status: 'accepted',
      originalDueDate: '2026-10-23',
      acceptedAt: '2026-10-23T17:00:00Z',
    },
    { ...task, id: 'cancelled', status: 'cancelled', originalDueDate: '2026-10-22' },
    {
      ...task,
      id: 'today',
      status: 'submitted',
      originalDueDate: '2026-10-24',
      dueDate: '2026-10-24',
    },
    {
      ...task,
      id: 'extended',
      status: 'in_progress',
      originalDueDate: '2026-10-22',
      dueDate: '2026-10-30',
    },
    { ...task, id: 'missing-date', status: 'assigned', originalDueDate: '', dueDate: '' },
  ];
  const result = selectReportModel(
    { tasks, resolutions: initialState.resolutions },
    { unit: 'all', meetingId: 'all', today: '2026-10-24' },
  );
  assert.deepEqual(
    result.dueCohort.map((task) => task.id),
    ['on-time', 'late', 'cancelled', 'extended'],
  );
  assert.deepEqual(
    result.onTime.map((task) => task.id),
    ['on-time'],
  );
  assert.equal(result.overdue.length, 0);
  assert.deepEqual(result.unitRows, [
    { name: task.unit, total: 6, active: 3, accepted: 2, waiting: 1, overdue: 0 },
  ]);
});

test('selectors isolate supplied snapshots and correctly combine unit and meeting filters', () => {
  const task = { ...initialState.tasks[0], reviewerId: '' };
  const source = {
    tasks: [task],
    resolutions: initialState.resolutions.filter((item) => item.id === task.resolutionId),
  };
  const meetingId = source.resolutions[0].meetingId;
  const filters = { unit: task.unit, meetingId, today: DEMO_TODAY };
  assert.deepEqual(selectReportModel(source, filters).tasks, [task]);
  assert.equal(selectReportModel(source, { ...filters, unit: 'absent' }).tasks.length, 0);
  assert.equal(selectReportModel(source, { ...filters, meetingId: 'absent' }).tasks.length, 0);
  assert.equal(selectReportModel({ ...source, resolutions: [] }, filters).tasks.length, 0);
  assert.deepEqual(
    selectReportModel({ ...source, resolutions: [] }, { ...filters, meetingId: 'all' }).tasks,
    [task],
  );
  assert.equal(buildTaskIndex([task], DEMO_TODAY).byParticipant.has(''), false);
  assert.equal(buildTaskIndex([], DEMO_TODAY).byOwner.size, 0);
  assert.equal(selectReportModel({ tasks: [], resolutions: [] }, filters).resolutionsById.size, 0);
});

test('reused date formatters preserve defaults, custom options, invalid values and Thai day boundaries', () => {
  for (const value of ['2026-10-24', '2026-10-23T17:00:00Z', '2026-10-23T16:59:59Z']) {
    const date = new Date(value.length === 10 ? `${value}T12:00:00+07:00` : value);
    for (const options of [
      {},
      { year: '2-digit', month: 'long' } as const,
      { timeZone: 'UTC', weekday: 'long' } as const,
    ]) {
      assert.equal(
        formatThaiDate(value, options),
        new Intl.DateTimeFormat('th-TH', {
          timeZone: 'Asia/Bangkok',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          ...options,
        }).format(date),
      );
    }
  }
  assert.equal(formatThaiDate('2026-02-30'), '—');
  assert.equal(formatThaiDate('invalid'), '—');
  assert.equal(daysUntil('2026-10-24', '2026-10-23T17:00:00Z'), 0);
  assert.equal(daysUntil('2026-10-24', '2026-10-23T16:59:59Z'), 1);
});
