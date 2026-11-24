import assert from 'node:assert/strict';
import test from 'node:test';
import { accountEmail, accountPassword } from './account';
test('account forms normalize email and reject invalid or unbounded input', () => {
  assert.equal(accountEmail(' Person@EXAMPLE.test '), 'person@example.test');
  for (const value of [null, 42, 'invalid', 'a b@example.test', 'a'.repeat(255) + '@example.test'])
    assert.equal(accountEmail(value), null);
});
test('password reset validates length and exact confirmation without trimming secrets', () => {
  const data = new FormData();
  data.set('password', 'a'.repeat(12));
  data.set('confirmation', 'a'.repeat(12));
  assert.equal(accountPassword(data), 'a'.repeat(12));
  data.set('confirmation', 'different');
  assert.equal(accountPassword(data), null);
  for (const password of ['short', 'a'.repeat(129)]) {
    data.set('password', password);
    data.set('confirmation', password);
    assert.equal(accountPassword(data), null);
  }
});
