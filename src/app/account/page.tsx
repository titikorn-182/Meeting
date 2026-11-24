import { PasswordPage } from '@/features/auth/password-page';
export const metadata = { title: 'บัญชีและรหัสผ่าน' };
export const dynamic = 'force-dynamic';
export default function AccountPage() {
  return <PasswordPage account />;
}
