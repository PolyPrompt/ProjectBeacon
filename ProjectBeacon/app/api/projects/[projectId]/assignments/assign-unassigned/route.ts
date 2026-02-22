import { NextResponse } from "next/server";
import {
  assignTasks,
  type TaskSkillRequirement,
} from "@/lib/assignment/assign-tasks";
import { generateTaskAssignments } from "@/lib/ai/generate-task-assignments";
import {
  mapRouteError,
  requireProjectAdmin,
  requireProjectAccess,
} from "@/lib/server/route-helpers";
import { jsonError } from "@/lib/server/errors";
import { selectRows, updateRows } from "@/lib/server/supabase-rest";
import type { TaskRow } from "@/types/planning";
import {
  loadEffectiveMemberSkills,
  loadProjectMembers,
} from "@/lib/assignment/effective-skills";

type TaskRequiredSkillJoin = {
  task_id: string;
  skill_id: string;
  weight: number;
};

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

    const adminResponse = requireProjectAdmin(access.membership);
    if (adminResponse) {
      return adminResponse;
    }

    const tasks = await selectRows<TaskRow>("tasks", {
      select:
        "id,project_id,assignee_user_id,title,description,status,difficulty_points,due_at,created_at,updated_at",
      project_id: `eq.${projectId}`,
      order: "created_at.asc",
    });

    const unassignedTodoCount = tasks.filter(
      (task) => task.status === "todo" && task.assignee_user_id === null,
    ).length;

    if (unassignedTodoCount === 0) {
      return NextResponse.json({
        projectId,
        assignedCount: 0,
        assignmentMode: "none",
      });
    }

    const members = await loadProjectMembers(projectId);
    if (members.length === 0) {
      return jsonError(
        400,
        "VALIDATION_ERROR",
        "No project members available for assignment.",
      );
    }

    const taskIds = tasks.map((task) => task.id);
    const requirements: TaskSkillRequirement[] =
      taskIds.length > 0
        ? (
            await selectRows<TaskRequiredSkillJoin>("task_required_skills", {
              select: "task_id,skill_id,weight",
              task_id: `in.(${taskIds.join(",")})`,
            })
          ).map((row) => ({
            taskId: row.task_id,
            skillId: row.skill_id,
            weight: row.weight,
          }))
        : [];

    const effectiveSkills = await loadEffectiveMemberSkills(
      projectId,
      members,
      tasks,
    );

    const normalizedTasks = tasks.map((task) => ({
      id: task.id,
      status: task.status,
      difficultyPoints: task.difficulty_points,
      assigneeUserId: task.assignee_user_id,
    }));

    const aiResult = await generateTaskAssignments({
      projectId,
      projectName: access.project.name,
      projectDescription: access.project.description,
      tasks: normalizedTasks,
      members: effectiveSkills,
      taskRequirements: requirements,
    });
    const aiAssignments = aiResult.assignments;

    const assignmentResult =
      aiAssignments
        ? {
            assignments: aiAssignments,
            assignedCount: aiAssignments.length,
          }
        : assignTasks(normalizedTasks, effectiveSkills, requirements);

    const assignmentMode = aiAssignments ? "openai" : "deterministic";

    for (const assignment of assignmentResult.assignments) {
      await updateRows<TaskRow>(
        "tasks",
        {
          assignee_user_id: assignment.assigneeUserId,
        },
        {
          id: `eq.${assignment.taskId}`,
          project_id: `eq.${projectId}`,
        },
      );
    }

    return NextResponse.json({
      projectId,
      assignedCount: assignmentResult.assignedCount,
      assignmentMode,
    });
  } catch (error) {
    return mapRouteError(error);
  }
}
