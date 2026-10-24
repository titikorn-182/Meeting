import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { requireSupabaseConfiguration } from "./config";

export async function createServerSupabaseClient() {
  const config = requireSupabaseConfiguration();
  const cookieStore = await cookies();
  return createServerClient<Database>(config.url, config.publishableKey, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components cannot set cookies. Proxy refreshes them before rendering.
        }
      },
    },
  });
}

export const createClient = createServerSupabaseClient;

/** Validates with Supabase Auth; callers still need current business membership/RLS. */
export async function getVerifiedUser() {
  const client = await createServerSupabaseClient();
  const { data, error } = await client.auth.getUser();
  return { client, user: error ? null : data.user, error };
}
