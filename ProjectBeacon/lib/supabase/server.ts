import { createClient } from "@supabase/supabase-js";

import { getEnv } from "@/lib/env";

type SupabaseSettings = {
  url: string;
  serviceRoleKey: string;
  anonKey: string;
};

const authOptions = {
  autoRefreshToken: false,
  persistSession: false,
  detectSessionInUrl: false,
};

function readSupabaseSettings(): SupabaseSettings {
  try {
    const env = getEnv();

    return {
      url: env.SUPABASE_URL,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
      anonKey: env.SUPABASE_ANON_KEY,
    };
  } catch {
    const url =
      process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_SECRET_KEY ??
      "";
    const anonKey =
      process.env.SUPABASE_ANON_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
      "";

    if (!url || !serviceRoleKey) {
      throw new Error(
        "Missing Supabase environment variables. Set SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      );
    }

    return {
      url,
      serviceRoleKey,
      anonKey,
    };
  }
}

export function getServiceSupabaseClient() {
  const settings = readSupabaseSettings();

  return createClient(settings.url, settings.serviceRoleKey, {
    auth: authOptions,
  });
}

export function getAnonSupabaseClient() {
  const settings = readSupabaseSettings();

  return createClient(settings.url, settings.anonKey || settings.serviceRoleKey, {
    auth: authOptions,
  });
}
