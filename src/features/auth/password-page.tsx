import Link from 'next/link';
import { AuthFrame } from './auth-frame';
import { AccountPasswordForm } from './account-forms';
import { getDataConfiguration } from '@/lib/supabase/config';
import { getVerifiedUser } from '@/lib/supabase/server';
export async function PasswordPage({ account = false }: { account?: boolean }) {
  const config = getDataConfiguration();
  let email: string | undefined;
  if (config.mode === 'supabase' && config.configured) {
    try {
      email = (await getVerifiedUser()).user?.email;
    } catch {
      /* Offer a retry path without exposing auth internals. */
    }
  }
  return (
    <AuthFrame
      title={account ? 'บัญชีและรหัสผ่าน' : 'ตั้งรหัสผ่านใหม่'}
      description={email ? `บัญชี ${email}` : 'ยืนยันบัญชีก่อนเปลี่ยนรหัสผ่าน'}
    >
      {email ? (
        <>
          <AccountPasswordForm requireCurrent={account} />
          <Link className="text-link mt-5" href="/">
            กลับพื้นที่ทำงาน
          </Link>
        </>
      ) : (
        <div className="stack">
          <p className="inline-alert warning" role="status">
            {account
              ? 'กรุณาเข้าสู่ระบบก่อนจัดการบัญชี'
              : 'ยังไม่ได้ยืนยันลิงก์ หรือเซสชันหมดอายุ เปิดลิงก์จากอีเมลด้วยเบราว์เซอร์ที่ใช้ขอรหัสผ่าน หรือส่งคำขอใหม่'}
          </p>
          <Link
            className="button button-primary"
            href={account ? '/login?next=/account' : '/forgot-password'}
          >
            {account ? 'เข้าสู่ระบบ' : 'ขอลิงก์ใหม่'}
          </Link>
        </div>
      )}
    </AuthFrame>
  );
}
