import { getEnv } from "@/lib/env";
import { getServiceSupabaseClient } from "@/lib/supabase/server";

export async function createDocumentSignedUrl(params: {
  storageKey: string;
  expiresInSeconds?: number;
}) {
  const supabase = getServiceSupabaseClient();
  const bucket = getEnv().SUPABASE_STORAGE_BUCKET;
  const expiresInSeconds = params.expiresInSeconds ?? 120;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(params.storageKey, expiresInSeconds, {
      download: false,
    });

  if (error || !data?.signedUrl) {
    throw error ?? new Error("Could not create signed URL.");
  }

  return {
    url: data.signedUrl,
    expiresInSeconds,
  };
}
