import { AuthFrame } from '@/features/auth/auth-frame';
import { AccountEmailForm } from '@/features/auth/account-forms';
import { getDataConfiguration } from '@/lib/supabase/config';
export const metadata = { title: 'ลืมรหัสผ่าน' };
export const dynamic = 'force-dynamic';
export default function ForgotPasswordPage() {
  const config = getDataConfiguration();
  return (
    <AuthFrame title="ลืมรหัสผ่าน" description="รับลิงก์ทางอีเมลเพื่อตั้งรหัสผ่านใหม่ของคุณ">
      <AccountEmailForm kind="recovery" enabled={config.mode === 'supabase' && config.configured} />
    </AuthFrame>
  );
}
