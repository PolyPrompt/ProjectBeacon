import { z } from "zod";

export type SupabaseConfig = {
  url: string;
  apiKey: string;
};

const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_SECRET_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  SUPABASE_SECRET_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_STRICT_GENERATION: z.coerce.boolean().default(false),
});

export type ServerEnv = {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_SECRET_KEY: string;
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL: string;
  OPENAI_STRICT_GENERATION: boolean;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_SECRET_KEY?: string;
};

let cachedEnv: ServerEnv | null = null;

function getFirstNonEmpty(
  source: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function resolveSupabaseConfig(
  source: Record<string, unknown>,
): SupabaseConfig | null {
  const url = getFirstNonEmpty(source, [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_URL",
  ]);
  const apiKey = getFirstNonEmpty(source, [
    "NEXT_PUBLIC_SUPABASE_SECRET_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SECRET_KEY",
  ]);

  if (!url || !apiKey) {
    return null;
  }

  return { url, apiKey };
}

export function getSupabaseConfig(): SupabaseConfig {
  const config = resolveSupabaseConfig(
    process.env as Record<string, string | undefined>,
  );

  if (!config) {
    throw new Error("Missing Supabase configuration in environment variables.");
  }

  return config;
}

export function getServerEnv(): ServerEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => issue.path.join("."));
    throw new Error(`Invalid server environment: ${missing.join(", ")}`);
  }

  const supabaseConfig = resolveSupabaseConfig(parsed.data);
  if (!supabaseConfig) {
    throw new Error("Invalid server environment: missing Supabase URL or key.");
  }

  cachedEnv = {
    ...parsed.data,
    NEXT_PUBLIC_SUPABASE_URL: supabaseConfig.url,
    NEXT_PUBLIC_SUPABASE_SECRET_KEY: supabaseConfig.apiKey,
  };

  return cachedEnv;
}

export const CLARIFICATION_CONFIDENCE_THRESHOLD = 85;
export const MAX_CLARIFICATION_QUESTIONS = 5;
