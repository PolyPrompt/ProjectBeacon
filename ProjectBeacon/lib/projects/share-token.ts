import { jwtVerify, SignJWT } from "jose";

import { ApiHttpError } from "@/lib/api/errors";
import { getEnv } from "@/lib/env";
import { getServiceSupabaseClient } from "@/lib/supabase/server";

const encoder = new TextEncoder();

function getJoinTokenSecret() {
  const env = getEnv();
  return encoder.encode(env.CLERK_SECRET_KEY);
}

export async function createProjectJoinToken(input: {
  projectId: string;
  issuerUserId: string;
}) {
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

  const token = await new SignJWT({
    projectId: input.projectId,
    issuerUserId: input.issuerUserId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .setSubject(input.projectId)
    .sign(getJoinTokenSecret());

  return {
    token,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function verifyProjectJoinToken(
  token: string,
): Promise<{ projectId: string }> {
  try {
    const { payload } = await jwtVerify(token, getJoinTokenSecret(), {
      algorithms: ["HS256"],
    });

    const projectId = payload.projectId;

    if (typeof projectId !== "string") {
      throw new ApiHttpError(
        400,
        "INVALID_TOKEN",
        "Join token payload is invalid",
      );
    }

    return { projectId };
  } catch {
    throw new ApiHttpError(
      400,
      "INVALID_TOKEN",
      "Join token is invalid or expired",
    );
  }
}

export async function joinProjectWithToken(input: {
  token: string;
  userId: string;
}) {
  const { projectId } = await verifyProjectJoinToken(input.token);
  const supabase = getServiceSupabaseClient();

  const { data: existingMember, error: existingError } = await supabase
    .from("project_members")
    .select("project_id,user_id")
    .eq("project_id", projectId)
    .eq("user_id", input.userId)
    .maybeSingle();

  if (existingError) {
    throw new ApiHttpError(
      500,
      "DB_ERROR",
      "Failed checking existing membership",
      existingError.message,
    );
  }

  if (existingMember) {
    return {
      projectId,
      userId: input.userId,
      joined: true,
      alreadyMember: true,
    };
  }

  const { error: insertError } = await supabase.from("project_members").insert({
    project_id: projectId,
    user_id: input.userId,
    role: "member",
  });

  if (insertError) {
    throw new ApiHttpError(
      500,
      "DB_ERROR",
      "Failed joining project",
      insertError.message,
    );
  }

  return {
    projectId,
    userId: input.userId,
    joined: true,
    alreadyMember: false,
  };
}
