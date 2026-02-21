import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class ApiHttpError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function jsonError(
  status: number,
  code: string,
  message: string,
  details?: unknown,
) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(details === undefined ? {} : { details }),
      },
    },
    { status },
  );
}

export function handleRouteError(error: unknown) {
  if (error instanceof ApiHttpError) {
    return jsonError(error.status, error.code, error.message, error.details);
  }

  if (error instanceof ZodError) {
    return jsonError(
      400,
      "VALIDATION_ERROR",
      "Invalid request payload",
      error.flatten(),
    );
  }

  const fallbackMessage =
    error instanceof Error ? error.message : "Unexpected server error";
  return jsonError(500, "INTERNAL_SERVER_ERROR", fallbackMessage);
}
