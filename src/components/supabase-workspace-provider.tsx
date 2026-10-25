'use client';
import type { ReactNode } from 'react';
import { getDataConfiguration } from '@/lib/supabase/config';
import { DEFAULT_TRACKING_SETTINGS } from '@/lib/settings';
import { bangkokToday } from '@/lib/workspace';
import { WorkspaceContext, type WorkspaceContextValue } from './workspace-context';
import { useWorkspaceSession } from '@/providers/connected/use-workspace-session';
import { useWorkspaceNotices } from '@/providers/connected/use-workspace-notices';
import { WorkspaceGate } from '@/providers/connected/workspace-gate';
import { WorkspaceToasts } from '@/providers/connected/workspace-toasts';
import { createWorkspaceActions } from '@/providers/connected/workspace-actions';

export function SupabaseWorkspaceProvider({ children }: { children: ReactNode }) {
  const { toasts, notify, dismiss, clear } = useWorkspaceNotices();
  const { session, snapshot, problem, status, busy } = useWorkspaceSession(notify, clear);
  const configuration = getDataConfiguration();
  if (!snapshot)
    return (
      <WorkspaceGate
        loading={status === 'loading'}
        problem={problem}
        configured={configuration.mode === 'supabase' && configuration.configured}
        refresh={session.refresh}
      />
    );
  const value: WorkspaceContextValue = {
    ...snapshot,
    user: snapshot.users.find((user) => user.id === snapshot.state.currentUserId)!,
    mode: 'supabase',
    ready: true,
    busy,
    today: bangkokToday(),
    notify,
    defaultSettings: DEFAULT_TRACKING_SETTINGS,
    supportsPersonnel: snapshot.features?.personnelManagement === true,
    ...createWorkspaceActions(session, notify),
  };
  return (
    <WorkspaceContext.Provider
      key={JSON.stringify([snapshot.state.currentUserId, snapshot.organization.id])}
      value={value}
    >
      {children}
      <WorkspaceToasts toasts={toasts} dismiss={dismiss} />
    </WorkspaceContext.Provider>
  );
}
