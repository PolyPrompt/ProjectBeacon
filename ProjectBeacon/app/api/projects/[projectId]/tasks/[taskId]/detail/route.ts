import { buildAssignmentReasoning } from "@/lib/tasks/assignment-reasoning";
import { requireAuthenticatedUserId } from "@/lib/server/auth";
import { HttpError, toErrorResponse } from "@/lib/server/errors";
import { requireProjectMembership } from "@/lib/server/project-access";
import { supabaseRestGet } from "@/lib/server/supabase-rest";
import {
  type TaskDependencyInput,
  type TimelineTaskInput,
  getTimelinePlacement,
} from "@/lib/workflow/task-timeline-position";
import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{
    projectId: string;
    taskId: string;
  }>;
};

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "blocked" | "done";
  due_at: string | null;
  difficulty_points: number | null;
  assignee_user_id: string | null;
  created_at: string | null;
};

type DependencyRow = {
  task_id: string;
  depends_on_task_id: string;
};

type TaskRequiredSkillRow = {
  skill_id: string;
  weight: number | null;
};

type SkillRow = {
  id: string;
  name: string;
};

type SkillLevelRow = {
  skill_id: string;
  level: number;
};

type UserRow = {
  id: string;
  name: string | null;
  email: string;
};

function buildInFilter(values: string[]): string {
  return [...new Set(values)]
    .filter((value) => value.length > 0)
    .map((value) => encodeURIComponent(value))
    .join(",");
}

async function getProjectTaskRows(projectId: string): Promise<TaskRow[]> {
  return supabaseRestGet<TaskRow[]>(
    `tasks?select=id,title,description,status,due_at,difficulty_points,assignee_user_id,created_at&project_id=eq.${encodeURIComponent(projectId)}`,
  );
}

async function getProjectDependencies(
  taskIds: string[],
): Promise<DependencyRow[]> {
  if (taskIds.length === 0) {
    return [];
  }

  const inFilter = buildInFilter(taskIds);

  return supabaseRestGet<DependencyRow[]>(
    `task_dependencies?select=task_id,depends_on_task_id&task_id=in.(${inFilter})&depends_on_task_id=in.(${inFilter})`,
  );
}

async function getAssigneeLabel(
  assigneeUserId: string | null,
): Promise<string | null> {
  if (!assigneeUserId) {
    return null;
  }

  const rows = await supabaseRestGet<UserRow[]>(
    `users?select=id,name,email&id=eq.${encodeURIComponent(assigneeUserId)}&limit=1`,
  );

  const user = rows.at(0);
  if (!user) {
    return null;
  }

  return user.name?.trim() || user.email;
}

async function getRequiredSkills(
  taskId: string,
): Promise<Array<{ id: string; name: string }>> {
  const requiredRows = await supabaseRestGet<TaskRequiredSkillRow[]>(
    `task_required_skills?select=skill_id,weight&task_id=eq.${encodeURIComponent(taskId)}`,
  );

  const requiredSkillIds = requiredRows.map((row) => row.skill_id);
  if (requiredSkillIds.length === 0) {
    return [];
  }

  const inFilter = buildInFilter(requiredSkillIds);
  const skillRows = await supabaseRestGet<SkillRow[]>(
    `skills?select=id,name&id=in.(${inFilter})`,
  );

  const skillNameById = new Map(skillRows.map((row) => [row.id, row.name]));

  return requiredSkillIds.map((skillId) => ({
    id: skillId,
    name: skillNameById.get(skillId) ?? skillId,
  }));
}

async function getEffectiveSkillLevels(
  projectId: string,
  userId: string | null,
  skillIds: string[],
): Promise<Map<string, number>> {
  if (!userId || skillIds.length === 0) {
    return new Map<string, number>();
  }

  const inFilter = buildInFilter(skillIds);

  const [globalRows, overrideRows] = await Promise.all([
    supabaseRestGet<SkillLevelRow[]>(
      `user_skills?select=skill_id,level&user_id=eq.${encodeURIComponent(userId)}&skill_id=in.(${inFilter})`,
    ),
    supabaseRestGet<SkillLevelRow[]>(
      `project_member_skills?select=skill_id,level&project_id=eq.${encodeURIComponent(projectId)}&user_id=eq.${encodeURIComponent(userId)}&skill_id=in.(${inFilter})`,
    ),
  ]);

  const skillLevels = new Map<string, number>();

  for (const row of globalRows) {
    skillLevels.set(row.skill_id, row.level);
  }

  for (const row of overrideRows) {
    skillLevels.set(row.skill_id, row.level);
  }

  return skillLevels;
}

export async function GET(
  request: Request,
  { params }: RouteContext,
): Promise<NextResponse> {
  try {
    const { projectId, taskId } = await params;
    const userId = requireAuthenticatedUserId(request);

    await requireProjectMembership(projectId, userId);

    const tasks = await getProjectTaskRows(projectId);
    const selectedTask = tasks.find((task) => task.id === taskId);

    if (!selectedTask) {
      throw new HttpError(404, "TASK_NOT_FOUND", "Task was not found.");
    }

    const taskIds = tasks.map((task) => task.id);
    const dependencies = await getProjectDependencies(taskIds);

    const timelineTasks: TimelineTaskInput[] = tasks.map((task) => ({
      id: task.id,
      dueAt: task.due_at,
      createdAt: task.created_at,
    }));

    const timelineDependencies: TaskDependencyInput[] = dependencies.map(
      (dependency) => ({
        taskId: dependency.task_id,
        dependsOnTaskId: dependency.depends_on_task_id,
      }),
    );

    const timelinePlacement = getTimelinePlacement(
      taskId,
      timelineTasks,
      timelineDependencies,
    );

    const dependencyTaskIds = dependencies
      .filter((dependency) => dependency.task_id === taskId)
      .map((dependency) => dependency.depends_on_task_id)
      .sort((left, right) => left.localeCompare(right));

    const requiredSkills = await getRequiredSkills(taskId);
    const effectiveSkillLevels = await getEffectiveSkillLevels(
      projectId,
      selectedTask.assignee_user_id,
      requiredSkills.map((skill) => skill.id),
    );

    const matchedSkills = requiredSkills
      .map((skill) => ({
        name: skill.name,
        level: effectiveSkillLevels.get(skill.id) ?? 0,
      }))
      .filter((skill) => skill.level > 0)
      .sort(
        (left, right) =>
          right.level - left.level || left.name.localeCompare(right.name),
      );

    const assignmentReasoning = buildAssignmentReasoning({
      assigneeLabel: await getAssigneeLabel(selectedTask.assignee_user_id),
      requiredSkillNames: requiredSkills.map((skill) => skill.name),
      matchedSkills,
      dependencyCount: dependencyTaskIds.length,
      difficultyPoints: selectedTask.difficulty_points,
    });

    return NextResponse.json({
      id: selectedTask.id,
      title: selectedTask.title,
      description: selectedTask.description ?? "",
      status: selectedTask.status,
      softDeadline: selectedTask.due_at,
      assignmentReasoning,
      dependencyTaskIds,
      timelineTaskUrl: `/projects/${encodeURIComponent(projectId)}/timeline?taskId=${encodeURIComponent(taskId)}`,
      timelinePlacement,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
