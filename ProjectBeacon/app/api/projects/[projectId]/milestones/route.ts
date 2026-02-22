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

const createMilestoneSchema = z.object({
  title: z.string().trim().min(1).max(120),
  dueAt: z.string().datetime({ offset: true }),
});

const deleteMilestoneSchema = z.object({
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

    const { data, error } = await supabase
      .from("tasks")
      .select("id,title,due_at,status")
      .eq("project_id", params.projectId)
      .not("due_at", "is", null)
      .order("due_at", { ascending: true });

    if (error) {
      return jsonError(
        500,
        "DB_ERROR",
        "Failed loading project milestones",
        error.message,
      );
    }

    return NextResponse.json(
      {
        milestones: (data ?? []).map((item) => ({
          id: item.id,
          title: item.title,
          dueAt: item.due_at,
          status: item.status,
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
    const payload = createMilestoneSchema.parse(await request.json());

    await requireProjectOwner(params.projectId, user.userId);

    const supabase = getServiceSupabaseClient();

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        project_id: params.projectId,
        assignee_user_id: null,
        title: payload.title,
        description: "",
        difficulty_points: 1,
        status: "todo",
        due_at: payload.dueAt,
      })
      .select("id,title,due_at,status")
      .single();

    if (error) {
      return jsonError(
        500,
        "DB_ERROR",
        "Failed creating project milestone",
        error.message,
      );
    }

    return NextResponse.json(
      {
        id: data.id,
        title: data.title,
        dueAt: data.due_at,
        status: data.status,
      },
      { status: 201 },
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
    const payload = deleteMilestoneSchema.parse(await request.json());

    await requireProjectOwner(params.projectId, user.userId);

    const supabase = getServiceSupabaseClient();

    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", payload.id)
      .eq("project_id", params.projectId);

    if (error) {
      return jsonError(
        500,
        "DB_ERROR",
        "Failed deleting project milestone",
        error.message,
      );
    }

    return NextResponse.json({ deleted: true }, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}
