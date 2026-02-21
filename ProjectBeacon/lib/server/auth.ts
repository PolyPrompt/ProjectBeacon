import { HttpError } from "@/lib/server/errors";

const USER_ID_HEADERS = [
  "x-user-id",
  "x-projectbeacon-user-id",
  "x-clerk-user-id",
] as const;

export function requireAuthenticatedUserId(request: Request): string {
  for (const headerName of USER_ID_HEADERS) {
    const headerValue = request.headers.get(headerName);

    if (typeof headerValue === "string" && headerValue.trim().length > 0) {
      return headerValue.trim();
    }
  }

  throw new HttpError(401, "UNAUTHENTICATED", "Authentication is required.");
}
