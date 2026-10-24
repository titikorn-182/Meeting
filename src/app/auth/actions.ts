"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDataConfiguration } from "@/lib/supabase/config";
import { safeRedirectPath } from "@/lib/supabase/redirect";

export interface SignInState { error: string | null }

export async function signIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const config = getDataConfiguration();
  if (config.mode !== "supabase" || !config.configured) return { error: "ยังตั้งค่าการเชื่อมต่อไม่ครบ กรุณาติดต่อผู้ดูแลระบบ" };
  const email = typeof formData.get("email") === "string" ? String(formData.get("email")).trim() : "";
  const password = typeof formData.get("password") === "string" ? String(formData.get("password")) : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length > 4096) return { error: "กรอกอีเมลและรหัสผ่านให้ครบถ้วน" };
  try {
    const client = await createServerSupabaseClient();
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) return { error: error.status === 429 ? "พยายามเข้าสู่ระบบหลายครั้ง กรุณารอสักครู่แล้วลองใหม่" : "เข้าสู่ระบบไม่สำเร็จ โปรดตรวจอีเมลและรหัสผ่าน หรือติดต่อผู้ดูแลบัญชี" };
  } catch { return { error: "ติดต่อระบบเข้าสู่ระบบไม่ได้ กรุณาลองใหม่อีกครั้ง" }; }
  redirect(safeRedirectPath(formData.get("next")));
}

export async function signOut(): Promise<void> {
  const config = getDataConfiguration();
  let failed = false;
  if (config.mode === "supabase" && config.configured) {
    try {
      const client = await createServerSupabaseClient();
      const { error } = await client.auth.signOut({ scope: "local" });
      failed = Boolean(error);
    } catch { failed = true; }
  }
  if (failed) redirect("/login?error=signout");
  redirect("/login");
}
