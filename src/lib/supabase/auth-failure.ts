import { isAuthRetryableFetchError, type AuthError } from '@supabase/supabase-js';
import { WorkspaceError } from '../workspace';

/** A temporary Auth outage is not evidence that the user's session expired. */
export function workspaceAuthFailure(error: AuthError | null): WorkspaceError {
  if (
    isAuthRetryableFetchError(error) ||
    (error?.status !== undefined && (error.status >= 500 || error.status === 429))
  )
    return new WorkspaceError('CONNECTION_FAILED', 503);
  return new WorkspaceError('UNAUTHENTICATED', 401);
}
