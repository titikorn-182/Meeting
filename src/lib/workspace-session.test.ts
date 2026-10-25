import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialState, users } from '../demo/fixtures/workspace';
import { DEFAULT_ROLE_PAGES } from './access-control';
import { WorkspaceError, type WorkspaceSnapshot } from './workspace';
import { WorkspaceSession, type WorkspaceNotice } from './workspace-session';
import { fetchWorkspaceJson } from './workspace-http';
import { createWorkspaceActions } from '../providers/connected/workspace-actions';

function fixture(userId = initialState.currentUserId, org = 'org-one'): WorkspaceSnapshot {
  return structuredClone({
    state: { ...initialState, currentUserId: userId },
    users,
    eligibleOwners: [],
    units: ['Test'],
    organization: { id: org, name: 'Session test' },
    permissions: [],
    roles: ['secretary'],
    access: {
      role: 'admin',
      pages: DEFAULT_ROLE_PAGES.admin,
      policies: DEFAULT_ROLE_PAGES,
      policyVersion: 1,
      members: { [userId]: { role: 'admin', version: 0 } },
    },
  });
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
function harness(configured = true) {
  const requests: Array<
    { url: string; init?: RequestInit } & ReturnType<typeof deferred<unknown>>
  > = [];
  const notices: Parameters<WorkspaceNotice>[] = [];
  const session = new WorkspaceSession({
    configured,
    notify: (...notice) => notices.push(notice),
    transport: (url, init) => {
      const pending = deferred<unknown>();
      requests.push({ url, init, ...pending });
      return pending.promise;
    },
  });
  return { session, requests, notices };
}
async function ready() {
  const h = harness();
  h.session.start();
  h.requests[0].resolve(fixture());
  await flush();
  assert.equal(h.session.getSnapshot().status, 'ready');
  return h;
}
const key = (init?: RequestInit): unknown => JSON.parse(String(init?.body)).idempotencyKey;

test('missing configuration fails closed without sending a request', async () => {
  const h = harness(false);
  h.session.start();
  await flush();
  assert.equal(h.requests.length, 0);
  assert.equal(h.session.getSnapshot().problem?.code, 'CONFIGURATION_REQUIRED');
  assert.equal(await h.session.command('mark_all_read', {}, 'saved'), null);
});
test('latest refresh wins even if the transport ignores cancellation', async () => {
  const h = harness();
  h.session.start();
  const latest = h.session.refresh();
  assert.equal(h.requests[0].init?.signal?.aborted, true);
  h.requests[1].resolve(fixture('u-thanaphorn'));
  assert.equal(await latest, true);
  h.requests[0].resolve(fixture());
  await flush();
  assert.equal(h.session.getSnapshot().snapshot?.state.currentUserId, 'u-thanaphorn');
});
test('unmount cancels reads and rejects late data; restarting supports Strict Mode', async () => {
  const h = harness();
  h.session.start();
  h.session.stop();
  assert.equal(h.requests[0].init?.signal?.aborted, true);
  h.session.start();
  h.requests[1].resolve(fixture('u-thanaphorn'));
  await flush();
  h.requests[0].resolve(fixture());
  await flush();
  assert.equal(h.session.getSnapshot().snapshot?.state.currentUserId, 'u-thanaphorn');
});
test('session invalidation hides data immediately and cannot accept an old refresh', async () => {
  const h = await ready();
  const pending = h.session.refresh();
  h.session.beginAuthChange();
  assert.equal(h.session.getSnapshot().snapshot, null);
  assert.equal(h.requests[1].init?.signal?.aborted, true);
  h.requests[1].resolve(fixture());
  assert.equal(await pending, false);
  assert.equal(await h.session.refresh(), false, 'Do not reload while logout is changing cookies');
  assert.equal(h.session.getSnapshot().problem?.code, 'UNAUTHENTICATED');
  h.session.endAuthChange();
  h.requests[2].resolve(fixture('u-thanaphorn'));
  await flush();
  assert.equal(h.session.getSnapshot().snapshot?.state.currentUserId, 'u-thanaphorn');
});
test('a lost auth completion hint can recover after the bounded pause', async (t) => {
  let now = 1_000;
  t.mock.method(Date, 'now', () => now);
  const h = await ready();
  h.session.beginAuthChange();
  now += 30_001;
  const recovered = h.session.refresh();
  h.requests[1].reject(new WorkspaceError('UNAUTHENTICATED', 401));
  assert.equal(await recovered, false);
  assert.equal(h.session.getSnapshot().problem?.code, 'UNAUTHENTICATED');
});
for (const code of [
  'UNAUTHENTICATED',
  'NO_MEMBERSHIP',
  'FORBIDDEN',
  'EMAIL_VERIFICATION_REQUIRED',
]) {
  test(`${code} on refresh removes the previous workspace`, async () => {
    const h = await ready();
    const refresh = h.session.refresh();
    h.requests[1].reject(new WorkspaceError(code, 403));
    assert.equal(await refresh, false);
    assert.equal(h.session.getSnapshot().snapshot, null);
    assert.equal(h.session.getSnapshot().problem?.code, code);
    assert.equal(await h.session.command('mark_all_read', {}, 'saved'), null);
  });
}
test('invalid server data never leaves an old snapshot visible', async () => {
  const h = await ready();
  const refresh = h.session.refresh();
  h.requests[1].resolve({ access: null });
  assert.equal(await refresh, false);
  assert.equal(h.session.getSnapshot().snapshot, null);
  assert.equal(h.session.getSnapshot().problem?.code, 'INVALID_RESPONSE');
});
test('a command cancels older reads and serializes competing commands and focus refreshes', async () => {
  const h = await ready();
  const oldRead = h.session.refresh();
  const write = h.session.command('mark_all_read', {}, 'saved');
  assert.equal(h.requests[1].init?.signal?.aborted, true);
  assert.equal(await h.session.command('mark_all_read', {}, 'duplicate'), null);
  assert.equal(await h.session.refresh(), false);
  assert.equal(h.requests.length, 3);
  h.requests[1].resolve(fixture('u-thanaphorn'));
  assert.equal(await oldRead, false);
  h.requests[2].resolve({});
  await flush();
  h.requests[3].resolve(fixture());
  assert.deepEqual(await write, {});
  assert.equal(h.session.getSnapshot().busy, false);
  assert.deepEqual(h.notices, [['saved', 'success']]);
});
test('uncertain writes reuse their idempotency key until a confirmed result', async () => {
  const h = await ready();
  const first = h.session.command('mark_all_read', {}, 'saved');
  h.requests[1].reject(new TypeError('offline'));
  assert.equal(await first, null);
  const retry = h.session.command('mark_all_read', {}, 'saved');
  assert.equal(key(h.requests[1].init), key(h.requests[2].init));
  h.requests[2].resolve({});
  await flush();
  h.requests[3].resolve(fixture());
  await retry;
  const next = h.session.command('mark_all_read', {}, 'saved');
  assert.notEqual(key(h.requests[2].init), key(h.requests[4].init));
  h.requests[4].reject(new TypeError('offline'));
  await next;
});
test('malformed command results preserve the retry key and do not claim success', async () => {
  const h = await ready();
  const first = h.session.command('mark_all_read', {}, 'saved');
  h.requests[1].resolve({ unexpected: true });
  assert.equal(await first, null);
  const retry = h.session.command('mark_all_read', {}, 'saved');
  assert.equal(key(h.requests[1].init), key(h.requests[2].init));
  h.requests[2].reject(new TypeError('offline'));
  await retry;
  assert.ok(h.notices.every(([, tone]) => tone === 'error'));
});
for (const identity of ['account', 'organization'] as const) {
  test(`changing ${identity} discards the old retry keys`, async () => {
    const h = await ready();
    const first = h.session.command('mark_all_read', {}, 'saved');
    h.requests[1].reject(new TypeError('offline'));
    await first;
    const changed = fixture(
      identity === 'account' ? 'u-thanaphorn' : initialState.currentUserId,
      identity === 'organization' ? 'org-two' : 'org-one',
    );
    const refresh = h.session.refresh();
    h.requests[2].resolve(changed);
    await refresh;
    const retry = h.session.command('mark_all_read', {}, 'saved');
    assert.notEqual(key(h.requests[1].init), key(h.requests[3].init));
    h.requests[3].reject(new TypeError('offline'));
    await retry;
  });
}
test('a late write cannot reload, notify, or clear the busy state of a new session', async () => {
  const h = await ready();
  const old = h.session.command('mark_all_read', {}, 'old success');
  h.session.beginAuthChange();
  assert.equal(h.requests[1].init?.signal?.aborted, true);
  h.session.endAuthChange();
  h.requests[2].resolve(fixture('u-thanaphorn'));
  await flush();
  const current = h.session.command('mark_all_read', {}, 'new success');
  h.requests[1].resolve({});
  assert.equal(await old, null);
  assert.equal(h.session.getSnapshot().busy, true);
  assert.equal(h.requests.length, 4);
  h.requests[3].resolve({});
  await flush();
  h.requests[4].resolve(fixture('u-thanaphorn'));
  await current;
  assert.deepEqual(h.notices, [['new success', 'success']]);
});
test('identity change during post-write reload suppresses the previous account result', async () => {
  const h = await ready();
  const write = h.session.command('mark_all_read', {}, 'old success');
  h.requests[1].resolve({});
  await flush();
  h.requests[2].resolve(fixture('u-thanaphorn'));
  assert.equal(await write, null);
  assert.equal(h.session.getSnapshot().busy, false);
  assert.equal(h.session.getSnapshot().snapshot?.state.currentUserId, 'u-thanaphorn');
  assert.deepEqual(h.notices, []);
});
test('unmount during a write suppresses all completion side effects', async () => {
  const h = await ready();
  const write = h.session.command('mark_all_read', {}, 'saved');
  h.session.stop();
  h.requests[1].resolve({});
  assert.equal(await write, null);
  assert.equal(h.requests[1].init?.signal?.aborted, true);
  assert.equal(h.requests.length, 2);
  assert.deepEqual(h.notices, []);
});
test('expired session during a write removes private data and unlocks the gate', async () => {
  const h = await ready();
  const write = h.session.command('mark_all_read', {}, 'saved');
  h.requests[1].reject(new WorkspaceError('UNAUTHENTICATED', 401));
  await write;
  assert.equal(h.session.getSnapshot().snapshot, null);
  assert.equal(h.session.getSnapshot().busy, false);
  assert.equal(h.session.getSnapshot().problem?.code, 'UNAUTHENTICATED');
});
test('confirmed write plus failed reload reports uncertainty without repeating the write', async () => {
  const h = await ready();
  const write = h.session.command('mark_all_read', {}, 'saved');
  h.requests[1].resolve({});
  await flush();
  h.requests[2].reject(new TypeError('offline'));
  assert.deepEqual(await write, {});
  assert.equal(h.session.getSnapshot().snapshot, null);
  assert.equal(h.notices[0][1], 'info');
  assert.equal(h.requests.filter((r) => r.init?.method === 'POST').length, 1);
});
test('stale version reloads authoritative data and reports the rejected edit', async () => {
  const h = await ready();
  const write = h.session.command('mark_all_read', {}, 'saved');
  h.requests[1].reject(new WorkspaceError('STALE_VERSION', 409));
  await flush();
  h.requests[2].resolve(fixture());
  assert.equal(await write, null);
  assert.equal(h.session.getSnapshot().status, 'ready');
  assert.equal(h.session.getSnapshot().busy, false);
  assert.equal(h.notices[0][1], 'error');
});
test('HTTP transport preserves caller cancellation and uses same-origin cookies without caching', async (t) => {
  const controller = new AbortController();
  t.mock.method(globalThis, 'fetch', async (_url: string, init: RequestInit) => {
    assert.equal(init.credentials, 'same-origin');
    assert.equal(init.cache, 'no-store');
    assert.ok(init.signal);
    controller.abort();
    assert.equal(init.signal.aborted, true);
    init.signal.throwIfAborted();
    return Response.json({});
  });
  await assert.rejects(fetchWorkspaceJson('/api/workspace', { signal: controller.signal }), {
    name: 'AbortError',
  });
});
test('HTTP transport validates error envelopes and rejects non-JSON failures', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ error: { code: 'UNAUTHENTICATED' } }, { status: 401 }),
  );
  await assert.rejects(fetchWorkspaceJson('/api/workspace'), {
    code: 'UNAUTHENTICATED',
    status: 401,
  });
  t.mock.method(globalThis, 'fetch', async () => new Response('unavailable', { status: 503 }));
  await assert.rejects(fetchWorkspaceJson('/api/workspace'), {
    code: 'CONNECTION_FAILED',
    status: 503,
  });
});

test('detached forms cannot send commands after signing back in as the same person', async () => {
  const h = await ready();
  const oldActions = createWorkspaceActions(h.session, () => {});
  h.session.beginAuthChange();
  h.session.endAuthChange();
  h.requests[1].resolve(fixture());
  await flush();
  const count = h.requests.length;
  await oldActions.markAllRead();
  assert.equal(
    h.requests.length,
    count,
    'Same identity must not reactivate commands from an earlier session',
  );
});
