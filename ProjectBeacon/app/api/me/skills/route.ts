import { NextResponse } from "next/server";
import { z } from "zod";

import { handleRouteError, jsonError } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/require-user";
import { ensureSkillByName } from "@/lib/skills/ensure-skill";
import { getServiceSupabaseClient } from "@/lib/supabase/server";

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

export async function GET() {
  try {
    const user = await requireUser();
    const supabase = getServiceSupabaseClient();

    const { data: userSkills, error: userSkillsError } = await supabase
      .from("user_skills")
      .select("id,skill_id,level")
      .eq("user_id", user.userId);

    if (userSkillsError) {
      return jsonError(
        500,
        "DB_ERROR",
        "Failed loading profile skills",
        userSkillsError.message,
      );
    }

    const skillIds = userSkills.map((item) => item.skill_id);

    const { data: skills, error: skillsError } = skillIds.length
      ? await supabase.from("skills").select("id,name").in("id", skillIds)
      : { data: [], error: null };

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
        skills: userSkills.map((item) => ({
          id: item.id,
          skillId: item.skill_id,
          skillName: skillNameById.get(item.skill_id) ?? "Unknown",
          level: item.level,
        })),
      },
      { status: 200 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const payload = createSkillSchema.parse(await request.json());
    const skill = await ensureSkillByName(payload.skillName);
    const supabase = getServiceSupabaseClient();

    const { data, error } = await supabase
      .from("user_skills")
      .upsert(
        {
          user_id: user.userId,
          skill_id: skill.id,
          level: payload.level,
        },
        {
          onConflict: "user_id,skill_id",
        },
      )
      .select("id,skill_id,level")
      .single();

    if (error) {
      return jsonError(
        500,
        "DB_ERROR",
        "Failed upserting user skill",
        error.message,
      );
    }

    return NextResponse.json(
      {
        id: data.id,
        skillId: data.skill_id,
        skillName: skill.name,
        level: data.level,
      },
      { status: 200 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const payload = updateSkillSchema.parse(await request.json());
    const supabase = getServiceSupabaseClient();

    const { data, error } = await supabase
      .from("user_skills")
      .update({ level: payload.level })
      .eq("id", payload.id)
      .eq("user_id", user.userId)
      .select("id,skill_id,level")
      .maybeSingle();

    if (error) {
      return jsonError(
        500,
        "DB_ERROR",
        "Failed updating user skill",
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
        id: data.id,
        skillId: data.skill_id,
        skillName: skill?.name ?? "Unknown",
        level: data.level,
      },
      { status: 200 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser();
    const payload = deleteSkillSchema.parse(await request.json());
    const supabase = getServiceSupabaseClient();

    const { error } = await supabase
      .from("user_skills")
      .delete()
      .eq("id", payload.id)
      .eq("user_id", user.userId);

    if (error) {
      return jsonError(
        500,
        "DB_ERROR",
        "Failed deleting user skill",
        error.message,
      );
    }

    return NextResponse.json({ deleted: true }, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}
