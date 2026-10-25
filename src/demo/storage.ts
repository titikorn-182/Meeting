import { workspaceStateSchema } from '@/lib/workspace-schema';
import { workflowRoleForAccessRole } from '@/lib/access-control';
import type { WorkspaceState } from '@/lib/types';
import { initialState, users } from './fixtures/workspace';
import {
  ACCESS_STORAGE_KEY,
  accessFrom,
  initialAccess,
  validAccess,
  type DemoAccessMetadata,
} from './access';

// Keep the deployed keys and version so existing demo data and page policies survive.
export const STORAGE_KEY = 'polubu-ui-demo-v1';
export const copyInitial = (): WorkspaceState => structuredClone(initialState);
export interface DemoSession {
  state: WorkspaceState;
  metadata: DemoAccessMetadata;
  storageUnavailable: boolean;
}

/** Read-only initialization; no writes or React state updates during restoration. */
export function readDemoSession(storage?: Pick<Storage, 'getItem'>): DemoSession {
  let state = copyInitial();
  let metadata = initialAccess();
  let storageUnavailable = false;
  try {
    const source = storage ?? window.localStorage;
    // Treat corrupt state independently from valid saved role policies.
    try {
      const saved = source.getItem(STORAGE_KEY);
      const parsed: unknown = saved ? JSON.parse(saved) : null;
      if (
        parsed &&
        typeof parsed === 'object' &&
        'version' in parsed &&
        parsed.version === 1 &&
        'state' in parsed
      ) {
        const result = workspaceStateSchema.safeParse(parsed.state);
        if (result.success && users.some((user) => user.id === result.data.currentUserId))
          state = result.data;
      }
    } catch {
      storageUnavailable = true;
    }
    try {
      const saved = source.getItem(ACCESS_STORAGE_KEY);
      const parsed: unknown = saved ? JSON.parse(saved) : null;
      if (validAccess(parsed)) metadata = parsed;
    } catch {
      storageUnavailable = true;
    }
  } catch {
    storageUnavailable = true;
  }
  return {
    state: {
      ...state,
      currentUserId: metadata.currentUserId,
      activeRole: workflowRoleForAccessRole(accessFrom(metadata).role),
    },
    metadata,
    storageUnavailable,
  };
}
