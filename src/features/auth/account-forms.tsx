'use client';
import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, LoaderCircle } from 'lucide-react';
import { announceSessionChange } from '@/lib/session-events';
import {
  changePassword,
  requestPasswordReset,
  resendConfirmation,
  resetPassword,
  type AccountActionState,
} from './account-actions';
import styles from '@/app/login/login.module.css';

function Feedback({ state }: { state: AccountActionState }) {
  return (
    <>
      {state.error && (
        <div className={styles.error} role="alert">
          <AlertCircle size={18} />
          <p>{state.error}</p>
        </div>
      )}
      {state.message && (
        <div className="inline-alert success" role="status">
          <CheckCircle2 size={18} />
          <p>{state.message}</p>
        </div>
      )}
    </>
  );
}
export function AccountEmailForm({
  kind,
  enabled,
}: {
  kind: 'recovery' | 'confirmation';
  enabled: boolean;
}) {
  const [cooldown, setCooldown] = useState(0);
  const [state, action, pending] = useActionState(
    async (previous: AccountActionState, data: FormData) => {
      try {
        const result = await (kind === 'recovery' ? requestPasswordReset : resendConfirmation)(
          previous,
          data,
        );
        if (result.message) setCooldown(60);
        return result;
      } catch {
        return { error: 'ส่งคำขอไม่ได้ กรุณาตรวจเครือข่ายแล้วลองใหม่' };
      }
    },
    { error: null },
  );
  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);
  return (
    <form action={action} className={styles.form} aria-busy={pending}>
      <div className="field">
        <label className="field-label" htmlFor="account-email">
          อีเมล
        </label>
        <input
          id="account-email"
          name="email"
          type="email"
          autoComplete="email"
          className="input"
          maxLength={254}
          required
          disabled={!enabled || pending}
          placeholder="name@example.ac.th"
        />
      </div>
      <Feedback state={state} />
      {!enabled && (
        <p role="status" className={styles.help}>
          โหมดนี้ยังไม่เปิดบริการส่งอีเมล
        </p>
      )}
      <button
        className={`button button-primary ${styles.submit}`}
        disabled={!enabled || pending || cooldown > 0}
        type="submit"
      >
        {pending ? (
          <>
            <LoaderCircle size={18} className={styles.spinner} />
            กำลังส่งคำขอ…
          </>
        ) : cooldown > 0 ? (
          `ส่งใหม่ได้ใน ${cooldown} วินาที`
        ) : kind === 'recovery' ? (
          'ส่งลิงก์ตั้งรหัสผ่านใหม่'
        ) : (
          'ส่งอีเมลยืนยันอีกครั้ง'
        )}
      </button>
    </form>
  );
}
export function AccountPasswordForm({ requireCurrent = false }: { requireCurrent?: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [current, setCurrent] = useState('');
  const [state, action, pending] = useActionState(
    async (previous: AccountActionState, data: FormData) => {
      try {
        const result = await (requireCurrent ? changePassword : resetPassword)(previous, data);
        if (!result.error) {
          announceSessionChange('changed');
          if (result.redirectTo) {
            router.replace(result.redirectTo);
            router.refresh();
          }
        }
        return result;
      } catch {
        return { error: 'บันทึกไม่ได้ กรุณาตรวจเครือข่ายแล้วลองใหม่' };
      }
    },
    { error: null },
  );
  return (
    <form action={action} className={styles.form} aria-busy={pending}>
      {requireCurrent && (
        <div className="field">
          <label className="field-label" htmlFor="current-password">
            รหัสผ่านปัจจุบัน
          </label>
          <input
            id="current-password"
            name="currentPassword"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
            type="password"
            autoComplete="current-password"
            className="input"
            required
            maxLength={4096}
            disabled={pending}
          />
        </div>
      )}
      <div className="field">
        <label className="field-label" htmlFor="new-password">
          รหัสผ่านใหม่
        </label>
        <input
          id="new-password"
          name="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          autoComplete="new-password"
          className="input"
          required
          minLength={12}
          maxLength={128}
          aria-describedby="password-hint"
          disabled={pending}
        />
        <p id="password-hint" className="muted text-sm">
          12–128 ตัวอักษร และต่างจากรหัสผ่านเดิม
        </p>
      </div>
      <div className="field">
        <label className="field-label" htmlFor="confirm-password">
          ยืนยันรหัสผ่านใหม่
        </label>
        <input
          id="confirm-password"
          name="confirmation"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          type="password"
          autoComplete="new-password"
          className="input"
          required
          minLength={12}
          maxLength={128}
          disabled={pending}
        />
      </div>
      <Feedback state={state} />
      <button type="submit" className={`button button-primary ${styles.submit}`} disabled={pending}>
        {pending ? 'กำลังบันทึก…' : 'บันทึกรหัสผ่านใหม่'}
      </button>
    </form>
  );
}
