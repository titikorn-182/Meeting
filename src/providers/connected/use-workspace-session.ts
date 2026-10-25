'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { getDataConfiguration } from '@/lib/supabase/config';
import { subscribeSessionChanges } from '@/lib/session-events';
import { WorkspaceSession, type WorkspaceNotice } from '@/lib/workspace-session';

const REFRESH_INTERVAL_MS = 60_000;

export function useWorkspaceSession(notify: WorkspaceNotice, clearNotices: () => void) {
  const [session] = useState(() => {
    const configuration = getDataConfiguration();
    const configured = configuration.mode === 'supabase' && configuration.configured;
    return new WorkspaceSession({
      configured,
      organizationId: configured ? configuration.organizationId : undefined,
      notify,
      clearNotices,
    });
  });
  const state = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );
  useEffect(() => {
    session.start();
    const refresh = () => {
      void session.refresh();
    };
    const refreshVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const unsubscribe = subscribeSessionChanges((change) => {
      if (change === 'changing') session.beginAuthChange();
      else session.endAuthChange();
    });
    const interval = window.setInterval(refreshVisible, REFRESH_INTERVAL_MS);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refreshVisible);
    document.addEventListener('visibilitychange', refreshVisible);
    return () => {
      unsubscribe();
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refreshVisible);
      document.removeEventListener('visibilitychange', refreshVisible);
      session.stop();
    };
  }, [session]);
  return { session, ...state };
}
