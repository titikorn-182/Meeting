'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ToastTone } from '@/components/workspace-context';

export interface WorkspaceToast {
  id: string;
  message: string;
  type: ToastTone;
}
const TOAST_LIFETIME_MS = 6_000;
const MAX_TOASTS = 3;

export function useWorkspaceNotices() {
  const [toasts, setToasts] = useState<WorkspaceToast[]>([]);
  const timers = useRef(new Set<number>());
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending) window.clearTimeout(timer);
      pending.clear();
    };
  }, []);
  const dismiss = useCallback((id: string) => {
    setToasts((items) => items.filter((item) => item.id !== id));
  }, []);
  const clear = useCallback(() => {
    for (const timer of timers.current) window.clearTimeout(timer);
    timers.current.clear();
    setToasts([]);
  }, []);
  const notify = useCallback(
    (message: string, type: ToastTone = 'success') => {
      const id = crypto.randomUUID();
      setToasts((items) => [...items.slice(-(MAX_TOASTS - 1)), { id, message, type }]);
      const timer = window.setTimeout(() => {
        timers.current.delete(timer);
        dismiss(id);
      }, TOAST_LIFETIME_MS);
      timers.current.add(timer);
    },
    [dismiss],
  );
  return { toasts, dismiss, notify, clear };
}
