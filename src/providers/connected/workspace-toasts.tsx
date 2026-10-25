'use client';
import { CheckCircle2, CircleAlert, Info, X } from 'lucide-react';
import type { WorkspaceToast } from './use-workspace-notices';
export function WorkspaceToasts({
  toasts,
  dismiss,
}: {
  toasts: WorkspaceToast[];
  dismiss: (id: string) => void;
}) {
  return (
    <div className="toast-region" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast toast-${toast.type}`}
          role={toast.type === 'error' ? 'alert' : 'status'}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 size={19} />
          ) : toast.type === 'error' ? (
            <CircleAlert size={19} />
          ) : (
            <Info size={19} />
          )}
          <span>{toast.message}</span>
          <button aria-label="ปิดข้อความ" onClick={() => dismiss(toast.id)}>
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
