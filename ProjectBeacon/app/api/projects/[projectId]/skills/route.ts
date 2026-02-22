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

const createSkillSchema = z.object({
  skillName: z.string().trim().min(1),
  level: z.number().int().min(1).max(5),
});

const updateSkillSchema = z.object({
  id: z.uuid(),
  level: z.number().int().min(1).max(5),
});

const deleteSkillSchema = z.object({
  id: z.uuid(),
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

    const { data: projectSkills, error: projectSkillsError } = await supabase
      .from("project_member_skills")
      .select("skill_id,level")
      .eq("project_id", params.projectId)
      .eq("user_id", user.userId);

    if (projectSkillsError) {
      return jsonError(
        500,
        "DB_ERROR",
        "Failed loading project skills",
        projectSkillsError.message,
      );
    }

    const projectSkillRows = projectSkills ?? [];

    if (projectSkillRows.length === 0) {
      return NextResponse.json({ skills: [] }, { status: 200 });
    }

    const skillIds = projectSkillRows.map((item) => item.skill_id);

    const { data: skills, error: skillsError } = await supabase
      .from("skills")
      .select("id,name")
      .in("id", skillIds);

    if (skillsError) {
      return jsonError(
        500,
        "DB_ERROR",
        "Failed loading skill names",
        skillsError.message,
      );
    }

    const skillNameById = new Map(
      (skills ?? []).map((skill) => [skill.id, skill.name]),
    );

    return NextResponse.json(
      {
        skills: projectSkillRows.map((item) => ({
          id: item.skill_id,
          skillId: item.skill_id,
          skillName: skillNameById.get(item.skill_id) ?? "Unknown",
          level: item.level,
          source: "project_override",
        })),
      },
      { status: 200 },
    );
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
    const payload = createSkillSchema.parse(await request.json());

    await requireProjectMember(params.projectId, user.userId);

    const supabase = getServiceSupabaseClient();
    const skill = await ensureSkillByName(payload.skillName);

    const { data, error } = await supabase
      .from("project_member_skills")
      .upsert(
        {
          project_id: params.projectId,
          user_id: user.userId,
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
        id: data.skill_id,
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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await requireUser();
    const params = paramsSchema.parse(await context.params);
    const payload = updateSkillSchema.parse(await request.json());

    await requireProjectMember(params.projectId, user.userId);

    const supabase = getServiceSupabaseClient();

    const { data, error } = await supabase
      .from("project_member_skills")
      .update({ level: payload.level })
      .eq("project_id", params.projectId)
      .eq("user_id", user.userId)
      .eq("skill_id", payload.id)
      .select("skill_id,level")
      .maybeSingle();

    if (error) {
      return jsonError(
        500,
        "DB_ERROR",
        "Failed updating project skill",
        error.message,
      );
    }

    if (!data) {
      return jsonError(404, "NOT_FOUND", "Skill row not found");
    }

    const { data: skill, error: skillError } = await supabase
      .from("skills")
      .select("name")
      .eq("id", data.skill_id)
      .maybeSingle();

    if (skillError) {
      return jsonError(
        500,
        "DB_ERROR",
        "Failed loading skill name",
        skillError.message,
      );
    }

    return NextResponse.json(
      {
        id: data.skill_id,
        skillId: data.skill_id,
        skillName: skill?.name ?? "Unknown",
        level: data.level,
        source: "project_override",
      },
      { status: 200 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await requireUser();
    const params = paramsSchema.parse(await context.params);
    const payload = deleteSkillSchema.parse(await request.json());

    await requireProjectMember(params.projectId, user.userId);

    const supabase = getServiceSupabaseClient();

    const { error } = await supabase
      .from("project_member_skills")
      .delete()
      .eq("project_id", params.projectId)
      .eq("user_id", user.userId)
      .eq("skill_id", payload.id);

    if (error) {
      return jsonError(
        500,
        "DB_ERROR",
        "Failed deleting project skill",
        error.message,
      );
    }

    return NextResponse.json({ deleted: true }, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}
