import { AuthFrame } from '@/features/auth/auth-frame';
import { AccountEmailForm } from '@/features/auth/account-forms';
import { getDataConfiguration } from '@/lib/supabase/config';
export const metadata = { title: 'ยืนยันอีเมล' };
export const dynamic = 'force-dynamic';
export default function VerifyEmailPage() {
  const config = getDataConfiguration();
  return (
    <AuthFrame
      title="ยืนยันอีเมลของคุณ"
      description="หากไม่ได้รับอีเมลหลังสมัคร หรือลิงก์เดิมหมดอายุ ขออีเมลยืนยันใหม่ได้ที่นี่"
    >
      <AccountEmailForm
        kind="confirmation"
        enabled={config.mode === 'supabase' && config.configured}
      />
    </AuthFrame>
  );
}
