import { NextResponse } from "next/server";
import { z } from "zod";

import { handleRouteError, jsonError } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/require-user";
import { toProjectPayload } from "@/lib/projects/dto";
import { getServiceSupabaseClient } from "@/lib/supabase/server";

const createProjectSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().min(1),
  deadline: z.string().datetime(),
});

export async function GET() {
  try {
    const user = await requireUser();
    const supabase = getServiceSupabaseClient();

    const { data: memberships, error: membershipError } = await supabase
      .from("project_members")
      .select("project_id")
      .eq("user_id", user.userId);

    if (membershipError) {
      return jsonError(
        500,
        "DB_ERROR",
        "Failed loading project memberships",
        membershipError.message,
      );
    }

    const projectIds = memberships.map((membership) => membership.project_id);

    if (projectIds.length === 0) {
      return NextResponse.json({ projects: [] }, { status: 200 });
    }

    const { data: projects, error: projectsError } = await supabase
      .from("projects")
      .select("*")
      .in("id", projectIds)
      .order("created_at", { ascending: false });

    if (projectsError) {
      return jsonError(
        500,
        "DB_ERROR",
        "Failed loading projects",
        projectsError.message,
      );
    }

    return NextResponse.json(
      { projects: projects.map(toProjectPayload) },
      { status: 200 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const payload = createProjectSchema.parse(body);

    const deadline = new Date(payload.deadline);

    if (Number.isNaN(deadline.getTime())) {
      return jsonError(
        400,
        "VALIDATION_ERROR",
        "Deadline must be a valid ISO datetime",
      );
    }

    if (deadline.getTime() <= Date.now()) {
      return jsonError(
        400,
        "VALIDATION_ERROR",
        "Deadline must be in the future",
      );
    }

    const supabase = getServiceSupabaseClient();

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .insert({
        name: payload.name,
        description: payload.description,
        deadline: deadline.toISOString(),
        owner_user_id: user.userId,
        planning_status: "draft",
      })
      .select("*")
      .single();

    if (projectError) {
      return jsonError(
        500,
        "DB_ERROR",
        "Failed creating project",
        projectError.message,
      );
    }

    const { error: memberError } = await supabase
      .from("project_members")
      .insert({
        project_id: project.id,
        user_id: user.userId,
        role: "owner",
      });

    if (memberError) {
      return jsonError(
        500,
        "DB_ERROR",
        "Project created, but owner membership setup failed",
        memberError.message,
      );
    }

    return NextResponse.json(toProjectPayload(project), { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
