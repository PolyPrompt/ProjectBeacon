import { createHmac } from "node:crypto";

import {
  isProjectAuthorizationError,
  projectForbiddenResponse,
  requireProjectMembership,
} from "@/lib/auth/project-role";
import { requireSessionUser } from "@/lib/auth/clerk-auth";
import { apiError } from "@/lib/api/errors";
import {
  getProjectMembership,
  resolveActorUserId,
} from "@/lib/projects/membership";
import { getServiceSupabaseClient } from "@/lib/supabase/server";

type ShareTokenPayload = {
  projectId: string;
  exp: number;
};

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function createShareToken(payload: ShareTokenPayload, secret: string) {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");

  return `${encodedPayload}.${signature}`;
}

function getShareTokenSecret() {
  return (
    process.env.PROJECT_SHARE_TOKEN_SECRET ??
    process.env.CLERK_SECRET_KEY ??
    process.env.OPENAI_API_KEY ??
    ""
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const sessionUser = await requireSessionUser();
    const { projectId } = await params;
    const supabase = getServiceSupabaseClient();

    const actorUserId = await resolveActorUserId(supabase, sessionUser);
    if (!actorUserId) {
      return apiError(
        "PROJECT_FORBIDDEN",
        "You are not a member of this project.",
        403,
      );
    }

    const membership = await getProjectMembership(
      supabase,
      projectId,
      actorUserId,
    );
    requireProjectMembership(membership?.role);

    const secret = getShareTokenSecret();
    if (!secret) {
      return apiError(
        "MISSING_SHARE_SECRET",
        "Project share token secret is not configured.",
        500,
      );
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const token = createShareToken(
      {
        projectId,
        exp: Math.floor(expiresAt.getTime() / 1000),
      },
      secret,
    );

    const joinUrl = `${new URL(request.url).origin}/join/${token}`;

    return Response.json({
      projectId,
      token,
      expiresAt: expiresAt.toISOString(),
      joinUrl,
    });
  } catch (error) {
    if (isProjectAuthorizationError(error)) {
      return projectForbiddenResponse(error);
    }

    return apiError(
      "INTERNAL_SERVER_ERROR",
      "Failed to generate share link.",
      500,
    );
  }
}
