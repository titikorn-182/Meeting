'use server';

import { headers } from 'next/headers';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getDataConfiguration } from '@/lib/supabase/config';
import { safeRedirectPath } from '@/lib/supabase/redirect';
import { parseSignUpInput, signUpCallbackUrl } from '@/lib/supabase/signup';

export interface SignInState {
  error: string | null;
  redirectTo?: string;
}
export interface SignUpState {
  error: string | null;
  redirectTo?: string;
  message?: string;
}

export async function signUp(_previous: SignUpState, formData: FormData): Promise<SignUpState> {
  const config = getDataConfiguration();
  if (config.mode !== 'supabase' || !config.configured)
    return { error: 'ยังไม่เปิดให้สมัครบัญชีในขณะนี้ กรุณาติดต่อผู้ดูแลระบบ' };
  const input = parseSignUpInput(formData);
  if (!input) return { error: 'ตรวจอีเมล และใช้รหัสผ่าน 12–128 ตัวอักษรที่ตรงกันทั้งสองช่อง' };
  const emailRedirectTo = signUpCallbackUrl((await headers()).get('origin'));
  if (!emailRedirectTo) return { error: 'ไม่สามารถระบุที่อยู่ของเว็บได้ กรุณาเปิดหน้าสมัครใหม่' };
  try {
    const client = await createServerSupabaseClient();
    const { data, error } = await client.auth.signUp({ ...input, options: { emailRedirectTo } });
    if (error)
      return {
        error:
          error.status === 429
            ? 'ส่งคำขอหลายครั้ง กรุณารอสักครู่แล้วลองใหม่'
            : 'ยังสมัครไม่ได้ กรุณาตรวจข้อมูลและลองใหม่ หากมีบัญชีแล้วให้เข้าสู่ระบบ หรือติดต่อผู้ดูแล',
      };
    if (data.session) return { error: null, redirectTo: '/' };
    return {
      error: null,
      message:
        'ยังไม่ได้รับเซสชันเข้าสู่ระบบ หากมีบัญชีแล้วให้เข้าสู่ระบบ หากเพิ่งสมัครให้ติดต่อผู้ดูแลตรวจการตั้งค่าบัญชีของระบบ',
    };
  } catch {
    return { error: 'ติดต่อระบบสมัครบัญชีไม่ได้ กรุณาลองใหม่อีกครั้ง' };
  }
}

export async function signIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const config = getDataConfiguration();
  if (config.mode !== 'supabase' || !config.configured)
    return { error: 'ยังตั้งค่าการเชื่อมต่อไม่ครบ กรุณาติดต่อผู้ดูแลระบบ' };
  const email =
    typeof formData.get('email') === 'string' ? String(formData.get('email')).trim() : '';
  const password =
    typeof formData.get('password') === 'string' ? String(formData.get('password')) : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length > 4096)
    return { error: 'กรอกอีเมลและรหัสผ่านให้ครบถ้วน' };
  try {
    const client = await createServerSupabaseClient();
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error)
      return {
        error:
          error.status === 429
            ? 'พยายามเข้าสู่ระบบหลายครั้ง กรุณารอสักครู่แล้วลองใหม่'
            : 'เข้าสู่ระบบไม่สำเร็จ โปรดตรวจอีเมลและรหัสผ่าน หรือติดต่อผู้ดูแลบัญชี',
      };
  } catch {
    return { error: 'ติดต่อระบบเข้าสู่ระบบไม่ได้ กรุณาลองใหม่อีกครั้ง' };
  }
  return { error: null, redirectTo: safeRedirectPath(formData.get('next')) };
}

export async function signOut(): Promise<{ redirectTo: string }> {
  const config = getDataConfiguration();
  let failed = false;
  if (config.mode === 'supabase' && config.configured) {
    try {
      const client = await createServerSupabaseClient();
      const { error } = await client.auth.signOut({ scope: 'local' });
      failed = Boolean(error);
    } catch {
      failed = true;
    }
  }
  return { redirectTo: failed ? '/login?error=signout' : '/login' };
}
