import { NextResponse } from "next/server";
import { z } from "zod";

import { handleRouteError, jsonError } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/require-user";
import { requireProjectMember } from "@/lib/projects/membership";
import { ensureSkillByName } from "@/lib/skills/ensure-skill";
import { getServiceSupabaseClient } from "@/lib/supabase/server";

const paramsSchema = z.object({
  projectId: z.uuid(),
});

const upsertProjectSkillSchema = z.object({
  userId: z.uuid().optional(),
  skillName: z.string().trim().min(1),
  level: z.number().int().min(1).max(5),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await requireUser();
    const params = paramsSchema.parse(await context.params);

    await requireProjectMember(params.projectId, user.userId);

    const supabase = getServiceSupabaseClient();

    const { data: members, error: membersError } = await supabase
      .from("project_members")
      .select("user_id")
      .eq("project_id", params.projectId);

    if (membersError) {
      return jsonError(
        500,
        "DB_ERROR",
        "Failed loading project members",
        membersError.message,
      );
    }

    const memberIds = members.map((member) => member.user_id);

    if (memberIds.length === 0) {
      return NextResponse.json({ skills: [] }, { status: 200 });
    }

    const { data: overrides, error: overridesError } = await supabase
      .from("project_member_skills")
      .select("user_id,skill_id,level")
      .eq("project_id", params.projectId)
      .in("user_id", memberIds);

    if (overridesError) {
      return jsonError(
        500,
        "DB_ERROR",
        "Failed loading project skill overrides",
        overridesError.message,
      );
    }

    const { data: profileSkills, error: profileError } = await supabase
      .from("user_skills")
      .select("user_id,skill_id,level")
      .in("user_id", memberIds);

    if (profileError) {
      return jsonError(
        500,
        "DB_ERROR",
        "Failed loading profile skills",
        profileError.message,
      );
    }

    const skillIds = new Set<string>();
    const overrideKeys = new Set<string>();

    for (const item of overrides) {
      skillIds.add(item.skill_id);
      overrideKeys.add(`${item.user_id}:${item.skill_id}`);
    }

    for (const item of profileSkills) {
      skillIds.add(item.skill_id);
    }

    const { data: skills, error: skillsError } = await supabase
      .from("skills")
      .select("id,name")
      .in("id", Array.from(skillIds));

    if (skillsError) {
      return jsonError(
        500,
        "DB_ERROR",
        "Failed loading skill names",
        skillsError.message,
      );
    }

    const skillNameById = new Map(
      skills.map((skill) => [skill.id, skill.name]),
    );

    const response = [
      ...overrides.map((item) => ({
        userId: item.user_id,
        skillId: item.skill_id,
        skillName: skillNameById.get(item.skill_id) ?? "Unknown",
        level: item.level,
        source: "project_override" as const,
      })),
      ...profileSkills
        .filter((item) => !overrideKeys.has(`${item.user_id}:${item.skill_id}`))
        .map((item) => ({
          userId: item.user_id,
          skillId: item.skill_id,
          skillName: skillNameById.get(item.skill_id) ?? "Unknown",
          level: item.level,
          source: "profile" as const,
        })),
    ];

    return NextResponse.json({ skills: response }, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await requireUser();
    const params = paramsSchema.parse(await context.params);
    const payload = upsertProjectSkillSchema.parse(await request.json());

    await requireProjectMember(params.projectId, user.userId);

    const targetUserId = payload.userId ?? user.userId;
    const supabase = getServiceSupabaseClient();

    const { data: membership, error: membershipError } = await supabase
      .from("project_members")
      .select("user_id")
      .eq("project_id", params.projectId)
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (membershipError) {
      return jsonError(
        500,
        "DB_ERROR",
        "Failed checking member scope",
        membershipError.message,
      );
    }

    if (!membership) {
      return jsonError(403, "FORBIDDEN", "Target user is not a project member");
    }

    const skill = await ensureSkillByName(payload.skillName);

    const { data, error } = await supabase
      .from("project_member_skills")
      .upsert(
        {
          project_id: params.projectId,
          user_id: targetUserId,
          skill_id: skill.id,
          level: payload.level,
        },
        {
          onConflict: "project_id,user_id,skill_id",
        },
      )
      .select("user_id,skill_id,level")
      .single();

    if (error) {
      return jsonError(
        500,
        "DB_ERROR",
        "Failed upserting project skill",
        error.message,
      );
    }

    return NextResponse.json(
      {
        userId: data.user_id,
        skillId: data.skill_id,
        skillName: skill.name,
        level: data.level,
        source: "project_override",
      },
      { status: 200 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
