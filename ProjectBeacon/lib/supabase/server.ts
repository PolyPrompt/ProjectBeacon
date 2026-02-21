import { createClient } from "@supabase/supabase-js";

type SupabaseSettings = {
  url: string;
  serviceRoleKey: string;
};

function readSupabaseSettings(): SupabaseSettings {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_SECRET_KEY ??
    "";

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return { url, serviceRoleKey };
}

export function getServiceSupabaseClient() {
  const { url, serviceRoleKey } = readSupabaseSettings();
  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
