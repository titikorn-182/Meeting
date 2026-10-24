import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { isPersonnelClaimUnavailable, needsVerifiedPersonnelEmail } from './personnel';
import { parseSignUpInput, signUpCallbackUrl } from './signup';
import { parseWorkspaceCommand, mapDatabaseError } from '../workspace-validation';

const uuid = '11111111-1111-4111-8111-111111111111';
const envelope = (operation: string, payload: object) => ({ organizationId: uuid, idempotencyKey: uuid, operation, payload });

test('personnel boundary normalizes email and strips forged account identity or activation', () => {
  const payload = { firstName: '  First ', lastName: ' Last  ', email: ' Staff@EXAMPLE.org ', unit: ' Office ', role: 'staff', userId: uuid, status: 'claimed', verified: true };
  assert.deepEqual(parseWorkspaceCommand(envelope('add_personnel', payload)).payload,
    { firstName: 'First', lastName: 'Last', email: 'staff@example.org', unit: 'Office', role: 'staff' });
  for (const invalid of [{ firstName: '' }, { lastName: 'x'.repeat(101) }, { email: 'not-an-email' }, { role: 'secretary' }, { firstName: 'name\nsecond' }]) {
    assert.throws(() => parseWorkspaceCommand(envelope('add_personnel', { ...payload, ...invalid })));
  }
});

test('pending role command requires invitation identity and a current version', () => {
  const payload = { invitationId: uuid, role: 'executive', expectedVersion: 2 };
  assert.deepEqual(parseWorkspaceCommand(envelope('set_pending_personnel_role', { ...payload, memberId: uuid })).payload, payload);
  for (const invalid of [{ invitationId: 'user-1' }, { expectedVersion: 0 }, { role: 'reviewer' }]) {
    assert.throws(() => parseWorkspaceCommand(envelope('set_pending_personnel_role', { ...payload, ...invalid })));
  }
  assert.equal(mapDatabaseError({ code: 'P0001', message: 'INVITATION_CLAIMED' }).status, 409);
  assert.equal(mapDatabaseError({ code: 'P0001', message: 'PERSONNEL_ALREADY_EXISTS' }).status, 409);
  for (const code of ['PERSONNEL_ALREADY_EXISTS', 'MEMBER_ALREADY_EXISTS']) {
    assert.equal(mapDatabaseError({ code: '23505', message: code }).code, code);
  }
  assert.equal(mapDatabaseError({ code: '23505', message: 'unknown constraint' }).code, 'STALE_VERSION');
});

test('old schema compatibility never swallows an error inside the claim function', () => {
  assert.equal(isPersonnelClaimUnavailable({ code: 'PGRST202', message: 'Could not find public.claim_workspace_invitations in schema cache' }), true);
  for (const error of [null, { code: 'PGRST202', message: 'get_workspace_state missing' }, { code: '42P01', message: 'claim_workspace_invitations missing table' }, { code: '42501', message: 'claim_workspace_invitations permission denied' }]) {
    assert.equal(isPersonnelClaimUnavailable(error), false);
  }
  assert.equal(needsVerifiedPersonnelEmail({ claimed: 0, emailVerified: false }), true);
  for (const data of [null, {}, { emailVerified: 'false' }, { emailVerified: true }]) assert.equal(needsVerifiedPersonnelEmail(data), false);
});

test('signup validates confirmation without trimming or changing the password', () => {
  const form = new FormData();
  form.set('email', ' Person@Example.org ');
  form.set('password', '  Password 1234 ');
  form.set('confirmation', '  Password 1234 ');
  assert.deepEqual(parseSignUpInput(form), { email: 'person@example.org', password: '  Password 1234 ' });
  form.set('confirmation', 'Password 1234');
  assert.equal(parseSignUpInput(form), null);
  for (const password of ['short', 'x'.repeat(129)]) {
    form.set('password', password); form.set('confirmation', password);
    assert.equal(parseSignUpInput(form), null);
  }
  form.set('password', 'valid-password'); form.set('confirmation', 'valid-password'); form.set('email', 'invalid');
  assert.equal(parseSignUpInput(form), null);
});

test('signup callback only accepts an origin and permits HTTP only for local development', () => {
  assert.equal(signUpCallbackUrl('https://meeting.example'), 'https://meeting.example/auth/callback');
  assert.equal(signUpCallbackUrl('http://127.0.0.1:3000'), 'http://127.0.0.1:3000/auth/callback');
  for (const origin of [null, 'null', 'http://meeting.example', 'https://user:secret@example.org', 'https://example.org/path', 'https://example.org?next=bad', 'javascript:alert(1)', '//example.org']) {
    assert.equal(signUpCallbackUrl(origin), null);
  }
});
