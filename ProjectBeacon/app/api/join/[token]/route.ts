import { NextResponse } from "next/server";
import { z } from "zod";

import { handleRouteError } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/require-user";
import { joinProjectWithToken } from "@/lib/projects/share-token";

const paramsSchema = z.object({
  token: z.string().min(1),
});

export async function POST(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const user = await requireUser();
    const params = paramsSchema.parse(await context.params);

    const result = await joinProjectWithToken({
      token: params.token,
      userId: user.userId,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}
