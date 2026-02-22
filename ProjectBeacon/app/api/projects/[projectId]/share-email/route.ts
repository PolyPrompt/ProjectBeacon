import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiHttpError, handleRouteError, jsonError } from "@/lib/api/errors";
import { sendProjectShareEmail } from "@/lib/email/send-project-share";
import { getEnv } from "@/lib/env";
import { requireUser } from "@/lib/auth/require-user";
import { requireProjectMember } from "@/lib/projects/membership";
import { createProjectJoinToken } from "@/lib/projects/share-token";

const paramsSchema = z.object({
  projectId: z.uuid(),
});

const requestSchema = z.object({
  emails: z.array(z.string().trim().min(1)).min(1),
  joinUrl: z.string().url().optional(),
  projectUrl: z.string().url().optional(),
});

const emailSchema = z.email();

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await requireUser();
    const params = paramsSchema.parse(await context.params);

    await requireProjectMember(params.projectId, user.userId);

    const payload = requestSchema.parse(await request.json());
    const { token, expiresAt } = await createProjectJoinToken({
      projectId: params.projectId,
      issuerUserId: user.userId,
    });
    const env = getEnv();
    const inviteUrl = `${env.NEXT_PUBLIC_APP_URL}/join/${encodeURIComponent(token)}`;

    if (payload.emails.length > 20) {
      return jsonError(
        429,
        "RATE_LIMITED",
        "You can only send up to 20 recipients per request",
      );
    }

    const sent: Array<{ email: string; status: "sent" }> = [];
    const failed: Array<{ email: string; reason: string }> = [];

    for (const email of payload.emails) {
      if (!emailSchema.safeParse(email).success) {
        failed.push({ email, reason: "Invalid email" });
        continue;
      }

      try {
        const result = await sendProjectShareEmail({
          to: email,
          projectUrl: inviteUrl,
          projectId: params.projectId,
        });

        sent.push(result);
      } catch (error) {
        const reason =
          error instanceof ApiHttpError
            ? `${error.message}${typeof error.details === "string" ? `: ${error.details}` : ""}`
            : error instanceof Error
              ? error.message
              : "Unknown error";
        failed.push({ email, reason });
      }
    }

    return NextResponse.json(
      {
        projectId: params.projectId,
        token,
        joinUrl: inviteUrl,
        expiresAt,
        sent,
        failed,
      },
      { status: 200 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
