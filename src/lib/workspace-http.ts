import { errorResponseSchema } from './workspace-commands';
import { WorkspaceError } from './workspace';

export const WORKSPACE_REQUEST_TIMEOUT_MS = 30_000;
export type WorkspaceTransport = (url: string, init?: RequestInit) => Promise<unknown>;

export const fetchWorkspaceJson: WorkspaceTransport = async (url, init) => {
  const timeout = AbortSignal.timeout(WORKSPACE_REQUEST_TIMEOUT_MS);
  const response = await fetch(url, {
    ...init,
    cache: 'no-store',
    credentials: 'same-origin',
    signal: init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout,
  });
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new WorkspaceError('CONNECTION_FAILED', response.status);
  }
  if (!response.ok) {
    const error = errorResponseSchema.safeParse(data);
    throw new WorkspaceError(
      error.success ? error.data.error.code : 'CONNECTION_FAILED',
      response.status,
    );
  }
  return data;
};
