import { getServiceSupabaseClient } from "@/lib/supabase/server";

function getStorageBucket() {
  const bucket =
    process.env.SUPABASE_STORAGE_BUCKET ??
    process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ??
    "";

  if (!bucket) {
    throw new Error(
      "Missing SUPABASE_STORAGE_BUCKET environment variable for document previews.",
    );
  }

  return bucket;
}

export async function createDocumentSignedUrl(params: {
  storageKey: string;
  expiresInSeconds?: number;
}) {
  const supabase = getServiceSupabaseClient();
  const bucket = getStorageBucket();
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
