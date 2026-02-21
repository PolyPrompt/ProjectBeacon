import { NextResponse } from "next/server";
import { z } from "zod";

import { handleRouteError } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/require-user";
import { getEnv } from "@/lib/env";
import { requireProjectMember } from "@/lib/projects/membership";
import { createProjectJoinToken } from "@/lib/projects/share-token";

const paramsSchema = z.object({
  projectId: z.uuid(),
});

export async function POST(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await requireUser();
    const params = paramsSchema.parse(await context.params);

    await requireProjectMember(params.projectId, user.userId);

    const { token, expiresAt } = await createProjectJoinToken({
      projectId: params.projectId,
      issuerUserId: user.userId,
    });

    const env = getEnv();
    const joinUrl = `${env.NEXT_PUBLIC_APP_URL}/join/${encodeURIComponent(token)}`;

    return NextResponse.json(
      {
        projectId: params.projectId,
        token,
        expiresAt,
        joinUrl,
      },
      { status: 200 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
