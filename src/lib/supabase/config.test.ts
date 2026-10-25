import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { getDataConfiguration } from './config';
import { safeRedirectPath } from './redirect';

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example_123456789',
};
const jwt = (role: string) =>
  [
    Buffer.from('{"alg":"HS256"}').toString('base64url'),
    Buffer.from(JSON.stringify({ role })).toString('base64url'),
    'signature',
  ].join('.');

test('no configured credentials defaults to demo, while explicit supabase fails closed', () => {
  assert.deepEqual(getDataConfiguration({}), { mode: 'demo' });
  const result = getDataConfiguration({ NEXT_PUBLIC_DATA_MODE: 'supabase' });
  assert.equal(result.mode, 'supabase');
  assert.ok(result.mode === 'supabase' && !result.configured && result.issues.length === 2);
});
test('partial, invalid and mistyped configuration never falls back to mock data', () => {
  for (const env of [
    { NEXT_PUBLIC_SUPABASE_URL: valid.NEXT_PUBLIC_SUPABASE_URL },
    { NEXT_PUBLIC_DATA_MODE: 'production' },
    { ...valid, NEXT_PUBLIC_SUPABASE_ORGANIZATION_ID: 'not-an-id' },
  ]) {
    const result = getDataConfiguration(env);
    assert.ok(result.mode === 'supabase' && !result.configured);
  }
});
test('publishable and legacy anon formats are allowed, privileged formats are rejected', () => {
  const publishable = getDataConfiguration(valid);
  assert.ok(publishable.mode === 'supabase' && publishable.configured);
  const anon = getDataConfiguration({
    NEXT_PUBLIC_SUPABASE_URL: valid.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt('anon'),
  });
  assert.ok(anon.mode === 'supabase' && anon.configured);
  for (const key of [jwt('service_role'), 'sb_secret_do_not_expose_123456', 'paste-key-here']) {
    const result = getDataConfiguration({ ...valid, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key });
    assert.ok(result.mode === 'supabase' && !result.configured);
    assert.ok(!JSON.stringify(result).includes(key));
  }
});
test('URLs require HTTPS outside local development and cannot contain credentials or query strings', () => {
  for (const url of [
    'http://example.supabase.co',
    'https://user:password@example.supabase.co',
    'https://example.supabase.co?secret=value',
    'https://example.supabase.co/rest/v1',
  ]) {
    const result = getDataConfiguration({ ...valid, NEXT_PUBLIC_SUPABASE_URL: url });
    assert.ok(result.mode === 'supabase' && !result.configured);
  }
  const local = getDataConfiguration({
    ...valid,
    NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321/',
  });
  assert.ok(
    local.mode === 'supabase' && local.configured && local.url === 'http://127.0.0.1:54321',
  );
});
test('explicit demo mode is available without making an auth connection', () => {
  assert.deepEqual(getDataConfiguration({ ...valid, NEXT_PUBLIC_DATA_MODE: 'demo' }), {
    mode: 'demo',
  });
});
test('post-login redirects retain local paths but reject external targets and header injection', () => {
  assert.equal(safeRedirectPath('/tasks?status=submitted'), '/tasks?status=submitted');
  for (const value of [
    'https://attacker.example',
    '//attacker.example',
    '/\\attacker.example',
    '/%2fattacker.example',
    '/%5cattacker.example',
    '/tasks%0d%0aLocation:evil',
    '/login',
    '/auth/callback',
    undefined,
  ]) {
    assert.equal(safeRedirectPath(value), '/');
  }
});
