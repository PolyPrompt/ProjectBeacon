export type SupabaseConfig = {
  url: string;
  apiKey: string;
};

function getEnvValue(keys: string[]): string | null {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return null;
}

export function getSupabaseConfig(): SupabaseConfig {
  const url = getEnvValue(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"]);
  const apiKey = getEnvValue([
    "NEXT_PUBLIC_SUPABASE_SECRET_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SECRET_KEY",
  ]);

  if (!url || !apiKey) {
    throw new Error("Missing Supabase configuration in environment variables.");
  }

  return { url, apiKey };
}
