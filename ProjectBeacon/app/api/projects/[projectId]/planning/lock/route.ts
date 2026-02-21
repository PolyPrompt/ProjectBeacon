import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/errors";
import {
  mapRouteError,
  requireOwner,
  requireProjectAccess,
} from "@/lib/server/route-helpers";
import { selectRows, updateRows } from "@/lib/server/supabase-rest";
import { validateDependencyGraph } from "@/lib/tasks/validate-dependency-graph";
import { canTransitionPlanningStatus } from "@/lib/tasks/planning-status";
import type { TaskDependencyRow, TaskRow } from "@/types/planning";

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const access = await requireProjectAccess(request, projectId);
    if (!access.ok) {
      return access.response;
    }

    const ownerResponse = requireOwner(access.membership);
    if (ownerResponse) {
      return ownerResponse;
    }

    if (
      !canTransitionPlanningStatus(access.project.planning_status, "locked")
    ) {
      return jsonError(
        409,
        "INVALID_STATE",
        "Project planning status must be draft to lock plan.",
      );
    }

    const tasks = await selectRows<TaskRow>("tasks", {
      select:
        "id,status,title,project_id,assignee_user_id,difficulty_points,description,due_at,created_at,updated_at",
      project_id: `eq.${projectId}`,
    });

    if (tasks.length === 0) {
      return jsonError(
        400,
        "VALIDATION_ERROR",
        "Plan must contain at least one task before lock.",
      );
    }

    const dependencies =
      tasks.length > 0
        ? await selectRows<TaskDependencyRow>("task_dependencies", {
            select: "id,task_id,depends_on_task_id",
            task_id: `in.(${tasks.map((task) => task.id).join(",")})`,
          })
        : [];

    const dependencyValidation = validateDependencyGraph(
      tasks.map((task) => task.id),
      dependencies.map((dependency) => ({
        taskId: dependency.task_id,
        dependsOnTaskId: dependency.depends_on_task_id,
      })),
    );

    if (!dependencyValidation.ok) {
      return jsonError(
        400,
        "VALIDATION_ERROR",
        "Dependency graph failed validation.",
        {
          reason: dependencyValidation.reason,
        },
      );
    }

    const [updatedProject] = await updateRows<{
      id: string;
      planning_status: "locked";
    }>(
      "projects",
      {
        planning_status: "locked",
      },
      {
        id: `eq.${projectId}`,
        planning_status: "eq.draft",
      },
    );

    if (!updatedProject) {
      return jsonError(
        409,
        "INVALID_STATE",
        "Project planning status changed before lock.",
      );
    }

    return NextResponse.json({
      projectId,
      planningStatus: updatedProject.planning_status,
    });
  } catch (error) {
    return mapRouteError(error);
  }
}
