import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeRedirectPath } from '@/lib/supabase/redirect';
import { getDataConfiguration } from '@/lib/supabase/config';

function redirectTo(path: string) {
  // A relative Location preserves the browser origin behind proxies and on localhost.
  const response = new NextResponse(null, { status: 303, headers: { Location: path } });
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export async function GET(request: NextRequest) {
  const configuration = getDataConfiguration();
  const code = request.nextUrl.searchParams.get('code');
  if (configuration.mode === 'supabase' && configuration.configured && code) {
    try {
      const client = await createServerSupabaseClient();
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (!error) return redirectTo(safeRedirectPath(request.nextUrl.searchParams.get('next')));
    } catch {
      /* Show a recoverable message without exposing Auth details or credentials. */
    }
  }
  return redirectTo('/login?error=callback');
}
