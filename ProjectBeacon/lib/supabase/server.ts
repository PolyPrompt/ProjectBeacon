import { createClient } from "@supabase/supabase-js";

import { getEnv } from "@/lib/env";

const authOptions = {
  autoRefreshToken: false,
  persistSession: false,
  detectSessionInUrl: false,
};

export function getServiceSupabaseClient() {
  const env = getEnv();

  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: authOptions,
  });
}

export function getAnonSupabaseClient() {
  const env = getEnv();

  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: authOptions,
  });
}
