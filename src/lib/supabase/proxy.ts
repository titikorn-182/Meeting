import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from './database.types';
import { getDataConfiguration } from './config';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const config = getDataConfiguration();
  if (config.mode !== 'supabase' || !config.configured) return response;

  const supabase = createServerClient<Database>(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet)
          response.cookies.set(name, value, options);
        for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
      },
    },
  });

  // Keep refresh immediately after client creation. API handlers also call getUser().
  // No redirect here: /login and API error responses must remain reachable.
  try {
    await supabase.auth.getClaims();
  } catch {
    /* The authenticated endpoint reports connectivity failures. */
  }
  response.headers.set('Cache-Control', 'private, no-cache, no-store, must-revalidate, max-age=0');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  return response;
}
