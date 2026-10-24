"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, CircleAlert, Info, LoaderCircle, RefreshCw, X } from 'lucide-react';
import { signOut } from '@/app/auth/actions';
import { getDataConfiguration } from '@/lib/supabase/config';
import { bangkokToday, isWorkspaceSnapshot, WorkspaceError, type CommandResult, type WorkspaceOperation, type WorkspaceSnapshot } from '@/lib/workspace';
import { WorkspaceContext, type ToastTone, type WorkspaceContextValue } from './workspace-context';

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, { cache: 'no-store', credentials: 'same-origin', ...init, signal: AbortSignal.timeout(30000) });
  let data: unknown;
  try { data = await response.json(); } catch { throw new WorkspaceError('CONNECTION_FAILED', response.status); }
  if (!response.ok) {
    const error = data as { error?: { code?: string } };
    throw new WorkspaceError(error.error?.code ?? 'CONNECTION_FAILED', response.status);
  }
  return data;
}

export function SupabaseWorkspaceProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const configuration = getDataConfiguration();
  const configured = configuration.mode === 'supabase' && configuration.configured;
  const configuredOrg = configuration.mode === 'supabase' && configuration.configured ? configuration.organizationId : undefined;
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const current = useRef<WorkspaceSnapshot | null>(null);
  const [problem, setProblem] = useState<WorkspaceError | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const requestSerial = useRef(0);
  const requestKeys = useRef(new Map<string, string>());
  const [toasts, setToasts] = useState<{ id: string; message: string; type: ToastTone }[]>([]);

  const notify = useCallback((message: string, type: ToastTone = 'success') => {
    const id = crypto.randomUUID();
    setToasts(items => [...items.slice(-2), { id, message, type }]);
    window.setTimeout(() => setToasts(items => items.filter(item => item.id !== id)), 6000);
  }, []);

  const refresh = useCallback(async (): Promise<boolean> => {
    const serial = ++requestSerial.current;
    try {
      if (!configured) throw new WorkspaceError('CONFIGURATION_REQUIRED', 503);
      const org = current.current?.organization.id ?? configuredOrg;
      const data = await fetchJson(`/api/workspace${org ? `?organizationId=${encodeURIComponent(org)}` : ''}`);
      if (!isWorkspaceSnapshot(data)) throw new WorkspaceError('INVALID_RESPONSE', 502);
      if (serial !== requestSerial.current) return false;
      current.current = data; setSnapshot(data); setProblem(null);
      return true;
    } catch (error) {
      if (serial !== requestSerial.current) return false;
      current.current = null; setSnapshot(null);
      setProblem(error instanceof WorkspaceError ? error : new WorkspaceError('CONNECTION_FAILED', 503));
      return false;
    } finally { if (serial === requestSerial.current) setLoading(false); }
  }, [configured, configuredOrg]);

  useEffect(() => {
    void refresh();
    const onFocus = () => { if (!busyRef.current) void refresh(); };
    const onVisibility = () => { if (document.visibilityState === 'visible') onFocus(); };
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible') onFocus(); }, 60000);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => { ++requestSerial.current; window.clearInterval(interval); window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onVisibility); };
  }, [refresh]);

  async function command(operation: WorkspaceOperation, payload: Record<string, unknown>, success: string): Promise<CommandResult | null> {
    const active = current.current;
    if (!active || busyRef.current) return null;
    busyRef.current = true; setBusy(true);
    // Keep this key after uncertain network failures: retry cannot duplicate a committed command.
    const fingerprint = JSON.stringify([active.organization.id, operation, payload]);
    const key = requestKeys.current.get(fingerprint) ?? crypto.randomUUID();
    requestKeys.current.set(fingerprint, key);
    try {
      const result = await fetchJson('/api/workspace', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: active.organization.id, operation, payload, idempotencyKey: key }),
      }) as CommandResult;
      requestKeys.current.delete(fingerprint);
      const reloaded = await refresh();
      notify(reloaded ? success : 'บันทึกแล้ว แต่ยังโหลดข้อมูลล่าสุดไม่ได้ กรุณาลองโหลดอีกครั้ง', reloaded ? 'success' : 'info');
      return result ?? {};
    } catch (error) {
      const failure = error instanceof WorkspaceError ? error : new WorkspaceError('CONNECTION_FAILED', 503);
      if (['UNAUTHENTICATED', 'FORBIDDEN', 'NO_MEMBERSHIP'].includes(failure.code)) {
        ++requestSerial.current; current.current = null; setSnapshot(null); setProblem(failure);
      } else if (failure.code === 'STALE_VERSION') await refresh();
      notify(failure.message, 'error');
      return null;
    } finally { busyRef.current = false; setBusy(false); }
  }
  const taskVersion = (id: string) => current.current?.state.tasks.find(task => task.id === id)?.rowVersion;
  const resolutionVersion = (id: string) => current.current?.state.resolutions.find(item => item.id === id)?.rowVersion;

  if (!snapshot || problem) {
    const pending = loading && !problem;
    const title = pending ? 'กำลังเปิดพื้นที่ทำงาน' : problem?.code === 'NO_MEMBERSHIP' ? 'รอรับสิทธิ์เข้าพื้นที่ทำงาน' : problem?.code === 'UNAUTHENTICATED' ? 'เข้าสู่ระบบเพื่อใช้งานต่อ' : 'ยังเปิดพื้นที่ทำงานไม่ได้';
    return <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-5 px-6 py-12" aria-busy={pending}>
      <span className="text-sm font-semibold text-[var(--teal)]">POLUBU Smart meeting</span>
      {pending ? <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <CircleAlert size={30} aria-hidden="true" />}
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-base leading-relaxed text-[var(--muted)]" role={problem ? 'alert' : 'status'}>{pending ? 'กำลังตรวจบัญชีและโหลดข้อมูลที่คุณมีสิทธิ์เข้าถึง' : problem?.message}</p>
      {!pending && <div className="flex flex-wrap gap-3">
        {problem?.code === 'UNAUTHENTICATED'
          ? <Link className="button button-primary" href={`/login?next=${encodeURIComponent(pathname)}`}>เข้าสู่ระบบ</Link>
          : <button type="button" className="button button-primary" onClick={() => { setLoading(true); setProblem(null); void refresh(); }}><RefreshCw size={16} />ลองโหลดอีกครั้ง</button>}
        {configured && problem?.code !== 'UNAUTHENTICATED' && <form action={signOut}><button className="button button-secondary" type="submit">เปลี่ยนบัญชี</button></form>}
      </div>}
    </main>;
  }

  const value: WorkspaceContextValue = {
    ...snapshot, state: snapshot.state, user: snapshot.users.find(user => user.id === snapshot.state.currentUserId)!,
    mode: 'supabase', ready: true, busy, today: bangkokToday(), notify, refresh,
    setRole() { notify('สิทธิ์ของบัญชีนี้กำหนดโดยผู้ดูแลพื้นที่ทำงาน', 'info'); },
    resetDemo() { notify('พื้นที่ทำงานจริงไม่มีการรีเซ็ตข้อมูลตัวอย่าง', 'info'); },
    async acknowledgeTask(id) { return !!await command('acknowledge_task', { id, expectedVersion: taskVersion(id) }, 'รับทราบการมอบหมายแล้ว'); },
    async transitionTask(id, status, note = '', criterionResults) { return !!await command('transition_task', { id, status, note, ...(criterionResults ? { criterionResults } : {}), expectedVersion: taskVersion(id) }, 'บันทึกผลการดำเนินงานแล้ว'); },
    async updateProgress(id, progress, note) { return !!await command('update_progress', { id, progress, note, expectedVersion: taskVersion(id) }, 'บันทึกความก้าวหน้าแล้ว'); },
    async addEvidence(id, evidence) { return !!await command('add_evidence', { id, evidence, expectedVersion: taskVersion(id) }, 'บันทึกลิงก์หลักฐานแล้ว'); },
    async createChangeRequest(input) { return !!await command('create_change_request', { ...input, expectedVersion: taskVersion(input.taskId) }, 'ยื่นคำขอแล้ว รอผู้มีอำนาจพิจารณา'); },
    async decideChange(id, approved, reason) { return !!await command('decide_change', { id, approved, reason, expectedVersion: current.current?.state.changes.find(change => change.id === id)?.rowVersion }, 'บันทึกผลพิจารณาแล้ว'); },
    async addResolution(input) { return (await command('add_resolution', input, 'บันทึกมติแล้ว'))?.id ?? null; },
    async authorizeResolution(id) { return !!await command('authorize_resolution', { id, reason: 'อนุญาตให้เริ่มดำเนินงานตามมติผ่านหน้ารายละเอียดมติ', expectedVersion: resolutionVersion(id) }, 'บันทึกการอนุญาตเริ่มดำเนินงานแล้ว'); },
    async addTask(input) { return (await command('add_task', input, 'มอบหมายงานแล้ว รอผู้รับผิดชอบรับทราบ'))?.id ?? null; },
    async closeResolution(id, criteriaConfirmed) { return !!await command('close_resolution', { id, criteriaConfirmed, reason: 'ตรวจเกณฑ์ระดับมติและงานจำเป็นครบแล้ว', expectedVersion: resolutionVersion(id) }, 'รับรองปิดมติแล้ว'); },
    async addMeeting(input) { return (await command('add_meeting', input, 'บันทึกการประชุมแล้ว'))?.id ?? null; },
    async updateSettings(patch) { return !!await command('update_settings', { patch }, 'บันทึกการตั้งค่าแล้ว'); },
    async markNotificationRead(id) { await command('mark_notification_read', { id }, 'ทำเครื่องหมายอ่านแล้ว'); },
    async markAllRead() { await command('mark_all_read', {}, 'ทำเครื่องหมายอ่านทั้งหมดแล้ว'); },
  };
  return <WorkspaceContext.Provider value={value}>{children}<div className="toast-region" aria-live="polite" aria-atomic="false">{toasts.map(toast => <div key={toast.id} className={`toast toast-${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'}>{toast.type === 'success' ? <CheckCircle2 size={19} /> : toast.type === 'error' ? <CircleAlert size={19} /> : <Info size={19} />}<span>{toast.message}</span><button aria-label="ปิดข้อความ" onClick={() => setToasts(items => items.filter(item => item.id !== toast.id))}><X size={16} /></button></div>)}</div></WorkspaceContext.Provider>;
}
