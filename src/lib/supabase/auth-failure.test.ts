import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AuthApiError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
} from '@supabase/supabase-js';
import { workspaceAuthFailure } from './auth-failure';

test('network errors and Auth outages remain retryable rather than expiring a session', () => {
  for (const error of [
    new AuthRetryableFetchError('offline', 0),
    new AuthApiError('unavailable', 503, undefined),
    new AuthApiError('rate limited', 429, undefined),
  ]) {
    const failure = workspaceAuthFailure(error);
    assert.equal(failure.code, 'CONNECTION_FAILED');
    assert.equal(failure.status, 503);
  }
});
test('missing or rejected Auth sessions require login without exposing SDK details', () => {
  for (const error of [
    null,
    new AuthSessionMissingError(),
    new AuthApiError('invalid token details', 401, undefined),
  ]) {
    const failure = workspaceAuthFailure(error);
    assert.equal(failure.code, 'UNAUTHENTICATED');
    assert.equal(failure.status, 401);
    assert.equal(failure.message.includes('token details'), false);
  }
});
