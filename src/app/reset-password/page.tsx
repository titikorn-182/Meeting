import { PasswordPage } from '@/features/auth/password-page';
export const metadata = { title: 'ตั้งรหัสผ่านใหม่' };
export const dynamic = 'force-dynamic';
export default function ResetPasswordPage() {
  return <PasswordPage />;
}
