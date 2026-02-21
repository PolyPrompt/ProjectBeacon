import { getSupabaseConfig } from "@/lib/server/env";
import { HttpError } from "@/lib/server/errors";

function buildRestUrl(path: string): string {
  const { url } = getSupabaseConfig();
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  return `${url}/rest/v1/${normalizedPath}`;
}

export async function supabaseRestGet<T>(path: string): Promise<T> {
  const { apiKey } = getSupabaseConfig();

  const response = await fetch(buildRestUrl(path), {
    method: "GET",
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorBody = await response.text();

    throw new HttpError(
      502,
      "UPSTREAM_DB_ERROR",
      "Failed to read from project datastore.",
      {
        status: response.status,
        body: errorBody,
      },
    );
  }

  return (await response.json()) as T;
}
