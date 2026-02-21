import { afterEach, vi } from "vitest";

const envDefaults: Record<string, string> = {
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_123",
  CLERK_SECRET_KEY: "sk_test_123",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_ANON_KEY: "anon_test_123",
  SUPABASE_SERVICE_ROLE_KEY: "service_role_test_123",
  SUPABASE_STORAGE_BUCKET: "project-documents",
  OPENAI_API_KEY: "openai_test_123",
};

for (const [key, value] of Object.entries(envDefaults)) {
  if (!process.env[key]) {
    process.env[key] = value;
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});
