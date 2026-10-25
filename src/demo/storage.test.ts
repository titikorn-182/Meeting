import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ACCESS_STORAGE_KEY, initialAccess, demoMemberCan } from './access';
import { copyInitial, readDemoSession, STORAGE_KEY } from './storage';

function storage(entries: Record<string, string>) {
  return { getItem: (key: string) => entries[key] ?? null };
}
test('restores existing v1 demo data, policies and pending personnel without writing storage', () => {
  const state = copyInitial();
  state.tasks[0].title = 'Previously saved work';
  const metadata = initialAccess();
  metadata.policies.user = ['tasks'];
  metadata.policyVersion = 3;
  metadata.members['pending-1'] = { role: 'staff', version: 2 };
  metadata.pendingPersonnel = {
    'pending-1': {
      id: 'pending-1',
      firstName: 'Test',
      lastName: 'Person',
      email: 'pending@example.test',
      unit: state.tasks[0].unit,
    },
  };
  const entries = {
    [STORAGE_KEY]: JSON.stringify({ version: 1, state }),
    [ACCESS_STORAGE_KEY]: JSON.stringify(metadata),
  };
  const restored = readDemoSession(storage(entries));
  assert.equal(restored.state.tasks[0].title, 'Previously saved work');
  assert.deepEqual(restored.metadata, metadata);
  assert.equal(restored.storageUnavailable, false);
  assert.deepEqual(entries[STORAGE_KEY], JSON.stringify({ version: 1, state }));
});
test('malformed saved data resets safely without discarding valid page policies', () => {
  const metadata = initialAccess();
  metadata.policies.user = ['tasks'];
  metadata.policyVersion = 2;
  for (const saved of [
    '{broken',
    JSON.stringify({ version: 1, state: { ...copyInitial(), tasks: [null] } }),
    JSON.stringify({ version: 99, state: copyInitial() }),
  ]) {
    const restored = readDemoSession(
      storage({ [STORAGE_KEY]: saved, [ACCESS_STORAGE_KEY]: JSON.stringify(metadata) }),
    );
    assert.equal(restored.state.tasks[0].title, copyInitial().tasks[0].title);
    assert.deepEqual(restored.metadata.policies.user, ['tasks']);
  }
});
test('blocked storage stays in demo with independent in-memory copies', () => {
  const blocked = {
    getItem() {
      throw new Error('Storage blocked');
    },
  };
  const first = readDemoSession(blocked);
  const second = readDemoSession(blocked);
  assert.equal(first.storageUnavailable, true);
  first.state.tasks[0].title = 'Changed';
  assert.notEqual(second.state.tasks[0].title, 'Changed');
  assert.deepEqual(first.metadata, initialAccess());
});
test('active persona follows access metadata after restoration', () => {
  const metadata = initialAccess();
  metadata.currentUserId = 'u-thanaphorn';
  const restored = readDemoSession(storage({ [ACCESS_STORAGE_KEY]: JSON.stringify(metadata) }));
  assert.equal(restored.state.currentUserId, metadata.currentUserId);
  assert.equal(restored.state.activeRole, 'owner');
});
test('render permissions use the supplied metadata snapshot, without reading mutable refs', () => {
  const before = initialAccess();
  const after = structuredClone(before);
  assert.equal(demoMemberCan(before, 'u-thanaphorn', 'task.work'), true);
  after.policies.staff = [];
  assert.equal(demoMemberCan(after, 'u-thanaphorn', 'task.work'), false);
  assert.equal(demoMemberCan(before, 'u-thanaphorn', 'task.work'), true);
});
