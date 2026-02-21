import { NextResponse } from "next/server";

export type ApiErrorPayload = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export class ApiHttpError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "ApiHttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class HttpError extends ApiHttpError {
  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(status, code, message, details);
    this.name = "HttpError";
  }
}

export function jsonError(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): NextResponse<ApiErrorPayload> {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        details,
      },
    },
    { status },
  );
}

export function toErrorResponse(error: unknown): NextResponse<ApiErrorPayload> {
  if (error instanceof ApiHttpError) {
    return jsonError(error.status, error.code, error.message, error.details);
  }

  if (error instanceof Error) {
    return jsonError(500, "INTERNAL_ERROR", error.message);
  }

  return jsonError(500, "INTERNAL_ERROR", "An unexpected error occurred.");
}
