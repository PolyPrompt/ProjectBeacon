const OPENAI_CHAT_COMPLETIONS_URL =
  "https://api.openai.com/v1/chat/completions";
const DEFAULT_MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 400;
const MAX_BACKOFF_MS = 12_000;
const MAX_SERVER_DELAY_MS = 60_000;

type OpenAIChatRequestInput = {
  apiKey: string;
  body: Record<string, unknown>;
  maxRetries?: number;
};

export type OpenAIChatRequestResult = {
  response: Response;
  attempts: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(rawValue: string | null): number | null {
  if (!rawValue) {
    return null;
  }

  const trimmed = rawValue.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const numeric = Number(trimmed);
  if (Number.isFinite(numeric) && numeric >= 0) {
    return Math.round(numeric * 1000);
  }

  const asDate = Date.parse(trimmed);
  if (Number.isNaN(asDate)) {
    return null;
  }

  return Math.max(0, asDate - Date.now());
}

function parseDurationToMs(rawValue: string | null): number | null {
  if (!rawValue) {
    return null;
  }

  const normalized = rawValue.trim().toLowerCase().replace(/\s+/g, "");
  if (normalized.length === 0) {
    return null;
  }

  if (/^\d+(\.\d+)?$/.test(normalized)) {
    return Math.round(Number(normalized) * 1000);
  }

  const tokenPattern = /(\d+(?:\.\d+)?)(ms|s|m|h)/g;
  let total = 0;
  let consumed = 0;

  for (const match of normalized.matchAll(tokenPattern)) {
    const value = Number(match[1]);
    if (!Number.isFinite(value) || value < 0) {
      return null;
    }

    const unit = match[2];
    if (unit === "ms") {
      total += value;
    } else if (unit === "s") {
      total += value * 1000;
    } else if (unit === "m") {
      total += value * 60_000;
    } else if (unit === "h") {
      total += value * 3_600_000;
    }

    consumed += match[0].length;
  }

  if (consumed === 0 || consumed !== normalized.length) {
    return null;
  }

  return Math.round(total);
}

function getServerSuggestedDelayMs(headers: Headers): number | null {
  const values = [
    parseRetryAfterMs(headers.get("retry-after")),
    parseDurationToMs(headers.get("x-ratelimit-reset-requests")),
    parseDurationToMs(headers.get("x-ratelimit-reset-tokens")),
  ].filter((value): value is number => typeof value === "number");

  if (values.length === 0) {
    return null;
  }

  return Math.min(MAX_SERVER_DELAY_MS, Math.max(...values));
}

function computeBackoffDelayMs(
  attempt: number,
  headers?: Headers,
  status?: number,
): number {
  const exponential = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** attempt);
  const jitter = Math.floor(Math.random() * 251);
  const fallbackDelay = exponential + jitter;

  if (status === 429 && headers) {
    const serverDelay = getServerSuggestedDelayMs(headers);
    if (serverDelay !== null) {
      return Math.max(fallbackDelay, serverDelay);
    }
  }

  return fallbackDelay;
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

export async function requestOpenAIChatCompletions(
  input: OpenAIChatRequestInput,
): Promise<OpenAIChatRequestResult> {
  const maxRetries = Math.max(0, input.maxRetries ?? DEFAULT_MAX_RETRIES);

  for (let attempt = 0; ; attempt += 1) {
    try {
      const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input.body),
      });

      if (!isRetryableStatus(response.status) || attempt >= maxRetries) {
        return {
          response,
          attempts: attempt + 1,
        };
      }

      await sleep(
        computeBackoffDelayMs(attempt, response.headers, response.status),
      );
    } catch (error) {
      if (attempt >= maxRetries) {
        throw error;
      }

      await sleep(computeBackoffDelayMs(attempt));
    }
  }
}
