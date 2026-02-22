import { HttpError } from "@/lib/server/errors";
import {
  mapRouteError,
  requireProjectAccess,
} from "@/lib/server/route-helpers";
import { supabaseRestGet } from "@/lib/server/supabase-rest";
import {
  type TaskDependencyInput,
  type TimelineTaskInput,
  getDueDatePlacement,
  getTimelinePlacement,
} from "@/lib/workflow/task-timeline-position";
import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{
    projectId: string;
    taskId: string;
  }>;
};

type ProjectRow = {
  id: string;
  created_at: string | null;
  deadline: string | null;
};

type TaskRow = {
  id: string;
  due_at: string | null;
  created_at: string | null;
};

type DependencyRow = {
  task_id: string;
  depends_on_task_id: string;
};

function buildInFilter(values: string[]): string {
  return [...new Set(values)]
    .filter((value) => value.length > 0)
    .map((value) => encodeURIComponent(value))
    .join(",");
}

async function getProject(projectId: string): Promise<ProjectRow> {
  const rows = await supabaseRestGet<ProjectRow[]>(
    `projects?select=id,created_at,deadline&id=eq.${encodeURIComponent(projectId)}&limit=1`,
  );

  const project = rows.at(0);

  if (!project) {
    throw new HttpError(404, "PROJECT_NOT_FOUND", "Project was not found.");
  }

  return project;
}

async function getProjectTasks(projectId: string): Promise<TaskRow[]> {
  return supabaseRestGet<TaskRow[]>(
    `tasks?select=id,due_at,created_at&project_id=eq.${encodeURIComponent(projectId)}`,
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

export async function GET(
  request: Request,
  { params }: RouteContext,
): Promise<NextResponse> {
  try {
    const { projectId, taskId } = await params;
    const access = await requireProjectAccess(request, projectId);
    if (!access.ok) {
      return access.response as NextResponse;
    }

    const [project, tasks] = await Promise.all([
      getProject(projectId),
      getProjectTasks(projectId),
    ]);

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

    const dependentTaskIds = dependencies
      .filter((dependency) => dependency.depends_on_task_id === taskId)
      .map((dependency) => dependency.task_id)
      .sort((left, right) => left.localeCompare(right));

    const dependencyDueAt = dependencyTaskIds
      .map(
        (dependencyTaskId) =>
          tasks.find((task) => task.id === dependencyTaskId)?.due_at,
      )
      .filter((value): value is string => typeof value === "string");

    const sortedDependencyDueAt = dependencyDueAt
      .map((value) => ({ value, timestamp: new Date(value).getTime() }))
      .filter((value) => !Number.isNaN(value.timestamp))
      .sort((left, right) => left.timestamp - right.timestamp)
      .map((value) => value.value);

    return NextResponse.json({
      taskId,
      timelinePlacement,
      dependencyTiming: {
        dependencyTaskIds,
        dependentTaskIds,
        earliestDependencyDeadline: sortedDependencyDueAt.at(0) ?? null,
        latestDependencyDeadline: sortedDependencyDueAt.at(-1) ?? null,
        dueDatePlacement: getDueDatePlacement(
          selectedTask.due_at,
          project.created_at,
          project.deadline,
        ),
      },
    });
  } catch (error) {
    return mapRouteError(error) as NextResponse;
  }
}
