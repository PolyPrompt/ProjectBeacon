import { NextResponse } from "next/server";
import { z } from "zod";

import { handleRouteError, jsonError } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/require-user";
import { toProjectPayload } from "@/lib/projects/dto";
import {
  requireProjectMember,
  requireProjectOwner,
} from "@/lib/projects/membership";
import { getServiceSupabaseClient } from "@/lib/supabase/server";

const paramsSchema = z.object({
  projectId: z.uuid(),
});

const updateProjectSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    description: z.string().trim().min(1).optional(),
    deadline: z.string().datetime().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
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

    const { data: project, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", params.projectId)
      .maybeSingle();

    if (error) {
      return jsonError(
        500,
        "DB_ERROR",
        "Failed loading project",
        error.message,
      );
    }

    if (!project) {
      return jsonError(404, "NOT_FOUND", "Project not found");
    }

    return NextResponse.json(toProjectPayload(project), { status: 200 });
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
    const body = await request.json();
    const payload = updateProjectSchema.parse(body);

    await requireProjectOwner(params.projectId, user.userId);

    const updateValues: Record<string, string> = {};

    if (payload.name) {
      updateValues.name = payload.name;
    }

    if (payload.description) {
      updateValues.description = payload.description;
    }

    if (payload.deadline) {
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

      updateValues.deadline = deadline.toISOString();
    }

    const supabase = getServiceSupabaseClient();

    const { data: updated, error } = await supabase
      .from("projects")
      .update(updateValues)
      .eq("id", params.projectId)
      .select("*")
      .maybeSingle();

    if (error) {
      return jsonError(
        500,
        "DB_ERROR",
        "Failed updating project",
        error.message,
      );
    }

    if (!updated) {
      return jsonError(404, "NOT_FOUND", "Project not found");
    }

    return NextResponse.json(toProjectPayload(updated), { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}
