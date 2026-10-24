'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowRight, Eye, EyeOff, LoaderCircle, MailCheck } from 'lucide-react';
import { signUp } from '@/app/auth/actions';
import styles from '../login/login.module.css';

export function SignUpForm({ enabled }: { enabled: boolean }) {
  const [state, action, pending] = useActionState(signUp, { error: null });
  const [visible, setVisible] = useState(false);
  if (state.message) return <div className={styles.form}>
    <div className={styles.setupNotice} role="status"><MailCheck size={21} aria-hidden="true" /><p>{state.message}</p></div>
    <Link href="/login" className={`button button-primary ${styles.submit}`}>ไปหน้าเข้าสู่ระบบ<ArrowRight size={18} /></Link>
  </div>;
  return <form action={action} className={styles.form} aria-busy={pending}>
    <div className="field"><label htmlFor="signup-email" className="field-label">อีเมลที่ผู้ดูแลระบุ</label><input id="signup-email" name="email" className="input" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={254} required disabled={pending || !enabled} aria-describedby="signup-email-help" /><p id="signup-email-help" className={styles.help}>ใช้อีเมลเดียวกับรายชื่อบุคลากรในหน่วยงาน</p></div>
    <div className="field"><label htmlFor="signup-password" className="field-label">ตั้งรหัสผ่าน</label><div className={styles.passwordField}><input id="signup-password" name="password" className="input" type={visible ? 'text' : 'password'} autoComplete="new-password" minLength={12} maxLength={128} required disabled={pending || !enabled} aria-describedby="signup-password-help" /><button className={styles.passwordToggle} type="button" aria-label={visible ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'} aria-pressed={visible} disabled={pending || !enabled} onClick={() => setVisible(value => !value)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div><p id="signup-password-help" className={styles.help}>ใช้ 12–128 ตัวอักษร และไม่ใช้รหัสผ่านร่วมกับบริการอื่น</p></div>
    <div className="field"><label htmlFor="signup-confirmation" className="field-label">ยืนยันรหัสผ่าน</label><input id="signup-confirmation" name="confirmation" className="input" type={visible ? 'text' : 'password'} autoComplete="new-password" minLength={12} maxLength={128} required disabled={pending || !enabled} /></div>
    {state.error && <div className={styles.error} role="alert"><AlertCircle size={18} /><p>{state.error}</p></div>}
    {!enabled && <p className={styles.help} role="status">โหมดทดลองแสดงตัวอย่างฟอร์มเท่านั้น การสมัครบัญชีจะพร้อมเมื่อเชื่อมต่อระบบจริง</p>}
    <button className={`button button-primary ${styles.submit}`} type="submit" disabled={pending || !enabled}>{pending ? <><LoaderCircle className={styles.spinner} size={18} />กำลังสมัคร…</> : <>สมัครและยืนยันอีเมล<ArrowRight size={18} /></>}</button>
    <p className={styles.help}>มีบัญชีแล้ว? <Link href="/login" className="underline underline-offset-4">เข้าสู่ระบบ</Link></p>
  </form>;
}
