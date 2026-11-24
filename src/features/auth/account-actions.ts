'use server';
import { headers } from 'next/headers';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getDataConfiguration } from '@/lib/supabase/config';
import { signUpCallbackUrl } from '@/lib/supabase/signup';
import { accountEmail, accountPassword } from '@/lib/supabase/account';

export interface AccountActionState {
  error: string | null;
  message?: string;
  redirectTo?: string;
}
function configured() {
  const config = getDataConfiguration();
  return config.mode === 'supabase' && config.configured;
}

async function requestEmail(
  kind: 'recovery' | 'confirmation',
  formData: FormData,
): Promise<AccountActionState> {
  if (!configured()) return { error: 'ยังไม่เปิดบริการบัญชีในโหมดนี้ กรุณาติดต่อผู้ดูแลระบบ' };
  const email = accountEmail(formData.get('email'));
  if (!email) return { error: 'กรอกอีเมลให้ถูกต้องก่อนส่งคำขอ' };
  const callback = signUpCallbackUrl((await headers()).get('origin'));
  if (!callback) return { error: 'เปิดหน้านี้ใหม่แล้วลองอีกครั้ง' };
  try {
    const client = await createServerSupabaseClient();
    const { error } =
      kind === 'recovery'
        ? await client.auth.resetPasswordForEmail(email, {
            redirectTo: `${callback}?next=/reset-password`,
          })
        : await client.auth.resend({
            type: 'signup',
            email,
            options: { emailRedirectTo: callback },
          });
    if (error?.status === 429) return { error: 'ส่งคำขอหลายครั้ง กรุณารอสักครู่ก่อนลองใหม่' };
    if (
      error &&
      !['user_not_found', 'email_not_confirmed', 'email_exists'].includes(error.code ?? '')
    )
      return { error: 'ติดต่อบริการอีเมลไม่ได้ กรุณาลองใหม่ภายหลัง' };
    // The same response for unknown, already-confirmed and eligible accounts avoids enumeration.
    return {
      error: null,
      message:
        kind === 'recovery'
          ? 'หากอีเมลนี้มีบัญชีที่ใช้งานได้ ระบบจะส่งลิงก์ตั้งรหัสผ่านใหม่ ตรวจกล่องจดหมายและสแปม แล้วเปิดลิงก์ด้วยเบราว์เซอร์ที่ใช้ส่งคำขอนี้'
          : 'หากอีเมลนี้มีบัญชีที่รอยืนยัน ระบบจะส่งลิงก์ให้ใหม่ ตรวจกล่องจดหมายและสแปม หากยืนยันแล้วให้กลับไปเข้าสู่ระบบ',
    };
  } catch {
    return { error: 'ติดต่อระบบไม่ได้ กรุณาลองใหม่อีกครั้ง' };
  }
}
export async function requestPasswordReset(_previous: AccountActionState, data: FormData) {
  return requestEmail('recovery', data);
}
export async function resendConfirmation(_previous: AccountActionState, data: FormData) {
  return requestEmail('confirmation', data);
}

async function savePassword(data: FormData, requireCurrent: boolean): Promise<AccountActionState> {
  if (!configured()) return { error: 'ยังไม่เปิดบริการบัญชีในโหมดนี้' };
  const password = accountPassword(data);
  if (!password) return { error: 'ใช้รหัสผ่าน 12–128 ตัวอักษร และกรอกให้ตรงกันทั้งสองช่อง' };
  try {
    const client = await createServerSupabaseClient();
    const { data: identity, error: identityError } = await client.auth.getUser();
    if (identityError || !identity.user?.email)
      return { error: 'เซสชันหมดอายุหรือยังไม่ได้ยืนยันลิงก์ กรุณาขอลิงก์ตั้งรหัสผ่านใหม่' };
    if (requireCurrent) {
      const current = data.get('currentPassword');
      if (typeof current !== 'string' || !current || current.length > 4096)
        return { error: 'กรอกรหัสผ่านปัจจุบันเพื่อยืนยันบัญชี' };
      const { data: verified, error } = await client.auth.signInWithPassword({
        email: identity.user.email,
        password: current,
      });
      if (error || verified.user?.id !== identity.user.id)
        return { error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง หรือยังยืนยันบัญชีไม่ได้' };
    }
    const { error } = await client.auth.updateUser({ password });
    if (error)
      return { error: 'ยังเปลี่ยนรหัสผ่านไม่ได้ ใช้รหัสผ่านใหม่ที่ต่างจากเดิม หรือลองขอลิงก์ใหม่' };
    const signedOut = await client.auth.signOut({ scope: 'local' });
    return signedOut.error
      ? {
          error: null,
          message: 'เปลี่ยนรหัสผ่านแล้ว กรุณาออกจากระบบแล้วเข้าสู่ระบบด้วยรหัสผ่านใหม่',
        }
      : { error: null, redirectTo: '/login?message=password-updated' };
  } catch {
    return { error: 'ติดต่อระบบไม่ได้ กรุณาตรวจเครือข่ายแล้วลองใหม่' };
  }
}
export async function resetPassword(_previous: AccountActionState, data: FormData) {
  return savePassword(data, false);
}
export async function changePassword(_previous: AccountActionState, data: FormData) {
  return savePassword(data, true);
}
