"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { requireSupabaseConfiguration } from "./config";

export function createBrowserSupabaseClient() {
  const config = requireSupabaseConfiguration();
  return createBrowserClient<Database>(config.url, config.publishableKey);
}

export const createClient = createBrowserSupabaseClient;
