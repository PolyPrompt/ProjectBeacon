import { NextResponse } from "next/server";
import { z } from "zod";

import { handleRouteError, jsonError } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/require-user";
import {
  requireProjectMember,
  requireProjectOwner,
} from "@/lib/projects/membership";
import { getServiceSupabaseClient } from "@/lib/supabase/server";

const paramsSchema = z.object({
  projectId: z.uuid(),
});

const importProfileSchema = z.object({
  userId: z.uuid().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await requireUser();
    const params = paramsSchema.parse(await context.params);
    const payload = importProfileSchema.parse(
      await request.json().catch(() => ({})),
    );

    const membership = await requireProjectMember(
      params.projectId,
      user.userId,
    );
    const targetUserId = payload.userId ?? user.userId;

    if (targetUserId !== user.userId) {
      await requireProjectOwner(params.projectId, user.userId);
    }

    const supabase = getServiceSupabaseClient();

    const { data: targetMember, error: memberError } = await supabase
      .from("project_members")
      .select("user_id")
      .eq("project_id", params.projectId)
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (memberError) {
      return jsonError(
        500,
        "DB_ERROR",
        "Failed validating target member",
        memberError.message,
      );
    }

    if (!targetMember) {
      return jsonError(
        403,
        "FORBIDDEN",
        "Target user is not a member of this project",
      );
    }

    const { data: profileSkills, error: profileError } = await supabase
      .from("user_skills")
      .select("skill_id,level")
      .eq("user_id", targetUserId);

    if (profileError) {
      return jsonError(
        500,
        "DB_ERROR",
        "Failed loading profile skills",
        profileError.message,
      );
    }

    if (profileSkills.length === 0) {
      return NextResponse.json({ imported: 0, updated: 0 }, { status: 200 });
    }

    const { data: existingOverrides, error: existingError } = await supabase
      .from("project_member_skills")
      .select("skill_id,level")
      .eq("project_id", params.projectId)
      .eq("user_id", targetUserId);

    if (existingError) {
      return jsonError(
        500,
        "DB_ERROR",
        "Failed reading existing project overrides",
        existingError.message,
      );
    }

    const existingMap = new Map(
      existingOverrides.map((item) => [item.skill_id, item.level]),
    );

    const rows = profileSkills.map((item) => ({
      project_id: params.projectId,
      user_id: targetUserId,
      skill_id: item.skill_id,
      level: item.level,
    }));

    const { error: upsertError } = await supabase
      .from("project_member_skills")
      .upsert(rows, {
        onConflict: "project_id,user_id,skill_id",
      });

    if (upsertError) {
      return jsonError(
        500,
        "DB_ERROR",
        "Failed importing profile skills",
        upsertError.message,
      );
    }

    let imported = 0;
    let updated = 0;

    for (const item of profileSkills) {
      const existingLevel = existingMap.get(item.skill_id);

      if (existingLevel === undefined) {
        imported += 1;
      } else if (existingLevel !== item.level) {
        updated += 1;
      }
    }

    return NextResponse.json(
      { imported, updated, actorRole: membership.role },
      { status: 200 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
