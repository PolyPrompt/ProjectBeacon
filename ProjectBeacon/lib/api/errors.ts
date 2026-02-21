import { NextResponse } from "next/server";

type ApiErrorShape = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export function apiError(
  code: string,
  message: string,
  status: number,
  details?: unknown,
) {
  const payload: ApiErrorShape = {
    error: {
      code,
      message,
      details: details ?? null,
    },
  };

  return NextResponse.json(payload, { status });
}
