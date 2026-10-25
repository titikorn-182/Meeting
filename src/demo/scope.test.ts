import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialAccess, accessFrom } from './access';
import { copyInitial } from './storage';
import { scopedDemoState } from './scope';

test('demo summary projection hides protected details and does not mutate saved work', () => {
  const metadata = initialAccess();
  metadata.currentUserId = 'u-somchai';
  metadata.policies.executive = ['dashboard'];
  const state = copyInitial();
  const before = structuredClone(state);
  const visible = scopedDemoState(state, accessFrom(metadata));
  assert.ok(visible.tasks.length > 0);
  for (const task of visible.tasks) {
    assert.equal(task.description, '');
    assert.equal(task.reviewerId, '');
    assert.deepEqual(task.evidence, []);
    assert.deepEqual(task.updates, []);
    assert.equal(task.rowVersion, undefined);
  }
  for (const resolution of visible.resolutions) {
    assert.equal(resolution.partialContext, true);
    assert.equal(resolution.content, '');
    assert.deepEqual(resolution.closureCriteria, []);
  }
  for (const meeting of visible.meetings) assert.deepEqual(meeting.agenda, []);
  assert.deepEqual(visible.settings.reminderDays, []);
  assert.deepEqual(state, before);
});
test('demo Staff sees owned tasks and minimal parent context after storage restoration', () => {
  const metadata = initialAccess();
  metadata.currentUserId = 'u-thanaphorn';
  const state = copyInitial();
  state.currentUserId = metadata.currentUserId;
  const visible = scopedDemoState(state, accessFrom(metadata));
  assert.ok(visible.tasks.length > 0);
  assert.ok(visible.tasks.every((task) => task.ownerId === state.currentUserId));
  assert.deepEqual(visible.meetings, []);
  assert.deepEqual(visible.audit, []);
  assert.ok(
    visible.resolutions.every(
      (resolution) => resolution.partialContext && !resolution.content && !resolution.coordinatorId,
    ),
  );
});
