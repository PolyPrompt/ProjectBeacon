import {
  roleCapabilities,
  type ProjectRole,
} from "@/lib/server/project-access";
import { supabaseRestGet } from "@/lib/server/supabase-rest";
import {
  getDueDatePlacement,
  orderTasksByDependency,
  type DueDatePlacement,
  type TaskDependencyInput,
  type TimelinePhase,
  type TimelineTaskInput,
} from "@/lib/workflow/task-timeline-position";

export type WorkflowTimelineTaskDTO = {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "blocked" | "done";
  softDeadline: string | null;
  difficultyPoints: 1 | 2 | 3 | 5 | 8;
  assigneeUserId: string | null;
  sequenceIndex: number;
  totalTasks: number;
  phase: TimelinePhase;
  dueDatePlacement: DueDatePlacement;
};

export type WorkflowTimelineViewDTO = {
  capability: ReturnType<typeof roleCapabilities>;
  tasks: WorkflowTimelineTaskDTO[];
  edges: Array<{
    taskId: string;
    dependsOnTaskId: string;
  }>;
};

type ProjectRow = {
  id: string;
  created_at: string | null;
  deadline: string | null;
};

type TaskRow = {
  id: string;
  title: string;
  status: string;
  due_at: string | null;
  difficulty_points: number | null;
  assignee_user_id: string | null;
  created_at: string | null;
};

type DependencyRow = {
  task_id: string;
  depends_on_task_id: string;
};

const VALID_STATUSES = ["todo", "in_progress", "blocked", "done"] as const;
const VALID_DIFFICULTY_POINTS = [1, 2, 3, 5, 8] as const;

function buildInFilter(values: string[]): string {
  return [...new Set(values)]
    .filter((value) => value.length > 0)
    .map((value) => encodeURIComponent(value))
    .join(",");
}

function normalizeStatus(
  value: string,
): "todo" | "in_progress" | "blocked" | "done" {
  if (VALID_STATUSES.includes(value as (typeof VALID_STATUSES)[number])) {
    return value as "todo" | "in_progress" | "blocked" | "done";
  }

  return "todo";
}

function normalizeDifficulty(value: number | null): 1 | 2 | 3 | 5 | 8 {
  if (
    value !== null &&
    VALID_DIFFICULTY_POINTS.includes(
      value as (typeof VALID_DIFFICULTY_POINTS)[number],
    )
  ) {
    return value as 1 | 2 | 3 | 5 | 8;
  }

  return 3;
}

function getPhase(sequenceIndex: number, totalTasks: number): TimelinePhase {
  if (totalTasks <= 1) {
    return "beginning";
  }

  const ratio = sequenceIndex / (totalTasks - 1);

  if (ratio < 1 / 3) {
    return "beginning";
  }

  if (ratio < 2 / 3) {
    return "middle";
  }

  return "end";
}

async function getProject(projectId: string): Promise<ProjectRow | null> {
  const rows = await supabaseRestGet<ProjectRow[]>(
    `projects?select=id,created_at,deadline&id=eq.${encodeURIComponent(projectId)}&limit=1`,
  );

  return rows.at(0) ?? null;
}

async function getTasks(projectId: string): Promise<TaskRow[]> {
  return supabaseRestGet<TaskRow[]>(
    `tasks?select=id,title,status,due_at,difficulty_points,assignee_user_id,created_at&project_id=eq.${encodeURIComponent(projectId)}`,
  );
}

async function getDependencies(taskIds: string[]): Promise<DependencyRow[]> {
  if (taskIds.length === 0) {
    return [];
  }

  const inFilter = buildInFilter(taskIds);

  return supabaseRestGet<DependencyRow[]>(
    `task_dependencies?select=task_id,depends_on_task_id&task_id=in.(${inFilter})&depends_on_task_id=in.(${inFilter})`,
  );
}

export async function getWorkflowTimelineView(
  projectId: string,
  viewerRole: ProjectRole,
): Promise<WorkflowTimelineViewDTO> {
  const [project, tasks] = await Promise.all([
    getProject(projectId),
    getTasks(projectId),
  ]);

  const dependencies = await getDependencies(tasks.map((task) => task.id));

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

  const orderedTaskIds = orderTasksByDependency(
    timelineTasks,
    timelineDependencies,
  );
  const taskById = new Map(tasks.map((task) => [task.id, task]));

  const orderedTasks = orderedTaskIds
    .map((taskId) => taskById.get(taskId))
    .filter((task): task is TaskRow => Boolean(task));

  const totalTasks = orderedTasks.length;

  const timelineTaskDtos: WorkflowTimelineTaskDTO[] = orderedTasks.map(
    (task, index) => ({
      id: task.id,
      title: task.title,
      status: normalizeStatus(task.status),
      softDeadline: task.due_at,
      difficultyPoints: normalizeDifficulty(task.difficulty_points),
      assigneeUserId: task.assignee_user_id,
      sequenceIndex: index,
      totalTasks,
      phase: getPhase(index, totalTasks),
      dueDatePlacement: getDueDatePlacement(
        task.due_at,
        project?.created_at ?? null,
        project?.deadline ?? null,
      ),
    }),
  );

  const edges = dependencies
    .map((dependency) => ({
      taskId: dependency.task_id,
      dependsOnTaskId: dependency.depends_on_task_id,
    }))
    .sort(
      (left, right) =>
        left.taskId.localeCompare(right.taskId) ||
        left.dependsOnTaskId.localeCompare(right.dependsOnTaskId),
    );

  return {
    capability: roleCapabilities(viewerRole),
    tasks: timelineTaskDtos,
    edges,
  };
}
