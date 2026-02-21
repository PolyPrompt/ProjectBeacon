import {
  normalizeProjectRole,
  roleCapabilities,
  type ProjectRole,
} from "@/lib/server/project-access";
import { supabaseRestGet } from "@/lib/server/supabase-rest";
import {
  orderTasksByDependency,
  type TaskDependencyInput,
  type TimelinePhase,
  type TimelineTaskInput,
} from "@/lib/workflow/task-timeline-position";

export type WorkflowBoardTaskDTO = {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "blocked" | "done";
  softDeadline: string | null;
  difficultyPoints: 1 | 2 | 3 | 5 | 8;
  phase: TimelinePhase;
};

export type WorkflowBoardViewDTO = {
  capability: ReturnType<typeof roleCapabilities>;
  columns: Array<{
    userId: string;
    name: string;
    email: string;
    role: ProjectRole;
    tasks: WorkflowBoardTaskDTO[];
  }>;
  unassigned: WorkflowBoardTaskDTO[];
};

type MemberRow = {
  user_id: string;
  role: string;
};

type UserRow = {
  id: string;
  name: string | null;
  email: string;
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

function compareTaskRows(a: TaskRow, b: TaskRow): number {
  const aDue = a.due_at
    ? new Date(a.due_at).getTime()
    : Number.POSITIVE_INFINITY;
  const bDue = b.due_at
    ? new Date(b.due_at).getTime()
    : Number.POSITIVE_INFINITY;

  if (aDue !== bDue) {
    return aDue - bDue;
  }

  return a.id.localeCompare(b.id);
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

function mapBoardTask(
  task: TaskRow,
  phaseByTaskId: Map<string, TimelinePhase>,
): WorkflowBoardTaskDTO {
  return {
    id: task.id,
    title: task.title,
    status: normalizeStatus(task.status),
    softDeadline: task.due_at,
    difficultyPoints: normalizeDifficulty(task.difficulty_points),
    phase: phaseByTaskId.get(task.id) ?? "middle",
  };
}

async function getMembers(projectId: string): Promise<MemberRow[]> {
  return supabaseRestGet<MemberRow[]>(
    `project_members?select=user_id,role&project_id=eq.${encodeURIComponent(projectId)}`,
  );
}

async function getUsers(userIds: string[]): Promise<Map<string, UserRow>> {
  if (userIds.length === 0) {
    return new Map<string, UserRow>();
  }

  const inFilter = buildInFilter(userIds);
  const users = await supabaseRestGet<UserRow[]>(
    `users?select=id,name,email&id=in.(${inFilter})`,
  );

  return new Map(users.map((user) => [user.id, user]));
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

export async function getWorkflowBoardView(
  projectId: string,
  viewerRole: ProjectRole,
): Promise<WorkflowBoardViewDTO> {
  const [members, tasks] = await Promise.all([
    getMembers(projectId),
    getTasks(projectId),
  ]);

  const userMap = await getUsers(members.map((member) => member.user_id));
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
  const phaseByTaskId = new Map<string, TimelinePhase>();

  orderedTaskIds.forEach((taskId, index) => {
    phaseByTaskId.set(taskId, getPhase(index, orderedTaskIds.length));
  });

  const sortedTasks = [...tasks].sort(compareTaskRows);

  const columns = members
    .map((member) => {
      const user = userMap.get(member.user_id);
      const role = normalizeProjectRole(member.role);

      return {
        userId: member.user_id,
        name: user?.name?.trim() || user?.email || member.user_id,
        email: user?.email || "",
        role,
        tasks: sortedTasks
          .filter((task) => task.assignee_user_id === member.user_id)
          .map((task) => mapBoardTask(task, phaseByTaskId)),
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));

  const unassigned = sortedTasks
    .filter((task) => !task.assignee_user_id)
    .map((task) => mapBoardTask(task, phaseByTaskId));

  return {
    capability: roleCapabilities(viewerRole),
    columns,
    unassigned,
  };
}
