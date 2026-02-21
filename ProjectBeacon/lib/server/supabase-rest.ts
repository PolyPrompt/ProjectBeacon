import { getServerEnv, getSupabaseConfig } from "@/lib/server/env";
import { HttpError } from "@/lib/server/errors";

export class SupabaseRequestError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details: unknown) {
    super(message);
    this.name = "SupabaseRequestError";
    this.status = status;
    this.details = details;
  }
}

type QueryParams = Record<string, string | number | boolean | undefined>;

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  query?: QueryParams;
  body?: unknown;
  prefer?: string;
};

function buildRestUrl(path: string): string {
  const { url } = getSupabaseConfig();
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  return `${url}/rest/v1/${normalizedPath}`;
}

function tryParseJson(text: string): unknown {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
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

  const text = await response.text();
  const payload = tryParseJson(text);

  if (!response.ok) {
    throw new HttpError(
      502,
      "UPSTREAM_DB_ERROR",
      "Failed to read from project datastore.",
      {
        status: response.status,
        body: payload,
      },
    );
  }

  return payload as T;
}

async function requestSupabase<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const env = getServerEnv();
  const url = new URL(`/rest/v1/${path}`, env.NEXT_PUBLIC_SUPABASE_URL);

  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const headers: Record<string, string> = {
    apikey: env.NEXT_PUBLIC_SUPABASE_SECRET_KEY,
    Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_SECRET_KEY}`,
    "Content-Type": "application/json",
  };

  if (options.prefer) {
    headers.Prefer = options.prefer;
  }

  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });

  const text = await response.text();
  const payload = tryParseJson(text);

  if (!response.ok) {
    throw new SupabaseRequestError(
      `Supabase request failed for ${path}`,
      response.status,
      payload,
    );
  }

  return payload as T;
}

export async function selectRows<T>(
  table: string,
  query: QueryParams,
): Promise<T[]> {
  return requestSupabase<T[]>(table, { method: "GET", query });
}

export async function selectSingle<T>(
  table: string,
  query: QueryParams,
): Promise<T | null> {
  const rows = await requestSupabase<T[]>(table, {
    method: "GET",
    query: {
      ...query,
      limit: 1,
    },
  });

  return rows[0] ?? null;
}

export async function insertRows<T, TInsert extends Record<string, unknown>>(
  table: string,
  rows: TInsert | TInsert[],
): Promise<T[]> {
  return requestSupabase<T[]>(table, {
    method: "POST",
    prefer: "return=representation",
    body: Array.isArray(rows) ? rows : [rows],
  });
}

export async function updateRows<T>(
  table: string,
  patch: Record<string, unknown>,
  filters: QueryParams,
): Promise<T[]> {
  return requestSupabase<T[]>(table, {
    method: "PATCH",
    prefer: "return=representation",
    query: filters,
    body: patch,
  });
}

export async function upsertRows<T, TInsert extends Record<string, unknown>>(
  table: string,
  rows: TInsert | TInsert[],
  onConflict: string,
): Promise<T[]> {
  return requestSupabase<T[]>(table, {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=representation",
    query: {
      on_conflict: onConflict,
    },
    body: Array.isArray(rows) ? rows : [rows],
  });
}

export async function deleteRows<T>(
  table: string,
  filters: QueryParams,
): Promise<T[]> {
  return requestSupabase<T[]>(table, {
    method: "DELETE",
    prefer: "return=representation",
    query: filters,
  });
}
