/** Public configuration only. Never put a Supabase secret/service-role key here. */
export interface PublicEnvironment {
  NEXT_PUBLIC_DATA_MODE?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  NEXT_PUBLIC_SUPABASE_ORGANIZATION_ID?: string;
}

export interface SupabaseConfiguration {
  mode: 'supabase';
  configured: true;
  url: string;
  publishableKey: string;
  organizationId?: string;
}

export type DataConfiguration =
  | { mode: 'demo' }
  | { mode: 'supabase'; configured: false; issues: string[] }
  | SupabaseConfiguration;

// Static references are intentional: Next.js replaces these in the browser bundle.
export function getPublicEnvironment(): PublicEnvironment {
  return {
    NEXT_PUBLIC_DATA_MODE: process.env.NEXT_PUBLIC_DATA_MODE,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_ORGANIZATION_ID: process.env.NEXT_PUBLIC_SUPABASE_ORGANIZATION_ID,
  };
}

function isPublicKey(value: string): boolean {
  if (/^sb_publishable_[A-Za-z0-9_-]{10,}$/.test(value)) return true;
  // This is only a configuration safeguard, not token verification. Supabase verifies JWTs.
  try {
    const parts = value.split('.');
    if (parts.length !== 3 || parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))) return false;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))) as {
      role?: string;
    };
    return payload.role === 'anon';
  } catch {
    return false;
  }
}

export function getDataConfiguration(
  env: PublicEnvironment = getPublicEnvironment(),
): DataConfiguration {
  const mode = env.NEXT_PUBLIC_DATA_MODE?.trim();
  const urlValue = env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '';
  const key =
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    '';
  const organizationId = env.NEXT_PUBLIC_SUPABASE_ORGANIZATION_ID?.trim() || undefined;
  if (mode === 'demo') return { mode: 'demo' };
  if (!mode && !urlValue && !key && !organizationId) return { mode: 'demo' };

  const issues: string[] = [];
  if (mode && mode !== 'supabase') issues.push('NEXT_PUBLIC_DATA_MODE ต้องเป็น demo หรือ supabase');
  let url = '';
  try {
    const parsed = new URL(urlValue);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
    if (parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:')) throw new Error();
    if (
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      !['', '/'].includes(parsed.pathname)
    )
      throw new Error();
    url = parsed.origin;
  } catch {
    issues.push(
      'ระบุ NEXT_PUBLIC_SUPABASE_URL เป็น Project URL ที่ถูกต้อง (ใช้ HTTPS หรือ localhost สำหรับพัฒนา)',
    );
  }
  if (!key || !isPublicKey(key))
    issues.push(
      'ระบุ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY หรือ legacy anon key ที่ถูกต้อง ห้ามใช้ secret/service_role key',
    );
  if (
    organizationId &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(organizationId)
  ) {
    issues.push('NEXT_PUBLIC_SUPABASE_ORGANIZATION_ID ต้องเป็น UUID หรือเว้นว่าง');
  }
  return issues.length
    ? { mode: 'supabase', configured: false, issues }
    : { mode: 'supabase', configured: true, url, publishableKey: key, organizationId };
}

export class SupabaseConfigurationError extends Error {
  constructor(public readonly issues: string[]) {
    super('ยังตั้งค่า Supabase ไม่ครบ กรุณาตรวจ .env.local');
    this.name = 'SupabaseConfigurationError';
  }
}

export function requireSupabaseConfiguration(): SupabaseConfiguration {
  const config = getDataConfiguration();
  if (config.mode === 'demo') throw new SupabaseConfigurationError(['เว็บอยู่ในโหมดทดลอง']);
  if (!config.configured) throw new SupabaseConfigurationError(config.issues);
  return config;
}
