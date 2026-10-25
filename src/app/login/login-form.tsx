'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowRight, Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { signIn, type SignInState } from '@/app/auth/actions';
import { announceSessionChange } from '@/lib/session-events';
import styles from './login.module.css';

export function LoginForm({ next, initialError }: { next: string; initialError?: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    async (previous: SignInState, data: FormData) => {
      try {
        const result = await signIn(previous, data);
        if (result.redirectTo) {
          announceSessionChange('changed');
          router.replace(result.redirectTo);
          router.refresh();
        }
        return result;
      } catch {
        return { error: 'ติดต่อระบบเข้าสู่ระบบไม่ได้ กรุณาลองใหม่อีกครั้ง' };
      }
    },
    { error: null },
  );
  const [visible, setVisible] = useState(false);
  const error = state.error || initialError;
  return (
    <form action={action} className={styles.form} aria-busy={pending}>
      <input type="hidden" name="next" value={next} />
      <div className="field">
        <label htmlFor="login-email" className="field-label">
          อีเมล
        </label>
        <input
          id="login-email"
          className="input"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          spellCheck={false}
          autoCapitalize="none"
          placeholder="name@example.ac.th"
          required
          disabled={pending}
          aria-describedby={error ? 'login-error' : undefined}
        />
      </div>
      <div className="field">
        <label htmlFor="login-password" className="field-label">
          รหัสผ่าน
        </label>
        <div className={styles.passwordField}>
          <input
            id="login-password"
            className="input"
            name="password"
            type={visible ? 'text' : 'password'}
            autoComplete="current-password"
            required
            disabled={pending}
            aria-describedby={error ? 'login-error' : undefined}
          />
          <button
            type="button"
            className={styles.passwordToggle}
            aria-label={visible ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
            aria-pressed={visible}
            onClick={() => setVisible((value) => !value)}
            disabled={pending}
          >
            {visible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>
      {error && (
        <div id="login-error" className={styles.error} role="alert">
          <AlertCircle size={18} />
          <p>{error}</p>
        </div>
      )}
      <button className={`button button-primary ${styles.submit}`} type="submit" disabled={pending}>
        {pending ? (
          <>
            <LoaderCircle size={18} className={styles.spinner} />
            กำลังเข้าสู่ระบบ…
          </>
        ) : (
          <>
            เข้าสู่ระบบ
            <ArrowRight size={18} />
          </>
        )}
      </button>
      <p className={styles.help}>
        ยังไม่มีบัญชี?{' '}
        <Link href="/signup" className="underline underline-offset-4">
          สมัครด้วยอีเมลที่ผู้ดูแลเพิ่มไว้
        </Link>
        <br />
        หากลืมรหัสผ่าน กรุณาติดต่อผู้ดูแลระบบของหน่วยงาน
      </p>
    </form>
  );
}
