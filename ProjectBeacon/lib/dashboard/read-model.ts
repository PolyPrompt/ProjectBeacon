import { HttpError } from "@/lib/server/errors";
import { supabaseRestGet } from "@/lib/server/supabase-rest";

export type TaskStatus = "todo" | "in_progress" | "blocked" | "done";
export type DifficultyPoints = 1 | 2 | 3 | 5 | 8;

export type DashboardTaskDTO = {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  softDeadline: string | null;
  difficultyPoints: DifficultyPoints;
};

export type DashboardSummaryDTO = {
  myTasks: DashboardTaskDTO[];
  finalDeadlineCountdownHours: number;
  nextMilestoneCountdownHours: number | null;
  teamStatus: {
    todo: number;
    inProgress: number;
    blocked: number;
    done: number;
  };
};

type MyTaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  difficulty_points: number | null;
  due_at: string | null;
};

type TaskStatusRow = {
  status: string;
};

type ProjectDeadlineRow = {
  deadline: string;
};

type MilestoneRow = {
  due_at: string;
};

const VALID_TASK_STATUSES: readonly TaskStatus[] = [
  "todo",
  "in_progress",
  "blocked",
  "done",
] as const;

const VALID_DIFFICULTY_POINTS: readonly DifficultyPoints[] = [
  1, 2, 3, 5, 8,
] as const;

function toCountdownHours(targetIsoDate: string): number {
  const nowMilliseconds = Date.now();
  const targetMilliseconds = new Date(targetIsoDate).getTime();

  if (Number.isNaN(targetMilliseconds)) {
    return 0;
  }

  const deltaHours = Math.ceil(
    (targetMilliseconds - nowMilliseconds) / (60 * 60 * 1000),
  );
  return Math.max(0, deltaHours);
}

function normalizeTaskStatus(value: string): TaskStatus {
  if (VALID_TASK_STATUSES.includes(value as TaskStatus)) {
    return value as TaskStatus;
  }

  return "todo";
}

function normalizeDifficultyPoints(value: number | null): DifficultyPoints {
  if (value && VALID_DIFFICULTY_POINTS.includes(value as DifficultyPoints)) {
    return value as DifficultyPoints;
  }

  return 3;
}

function mapDashboardTask(row: MyTaskRow): DashboardTaskDTO {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    status: normalizeTaskStatus(row.status),
    softDeadline: row.due_at,
    difficultyPoints: normalizeDifficultyPoints(row.difficulty_points),
  };
}

export async function getMyTasksReadModel(
  projectId: string,
  userId: string,
): Promise<DashboardTaskDTO[]> {
  const rows = await supabaseRestGet<MyTaskRow[]>(
    `tasks?select=id,title,description,status,difficulty_points,due_at&project_id=eq.${encodeURIComponent(projectId)}&assignee_user_id=eq.${encodeURIComponent(userId)}&order=due_at.asc.nullslast`,
  );

  return rows.map(mapDashboardTask);
}

async function getFinalDeadlineCountdownHours(
  projectId: string,
): Promise<number> {
  const rows = await supabaseRestGet<ProjectDeadlineRow[]>(
    `projects?select=deadline&id=eq.${encodeURIComponent(projectId)}&limit=1`,
  );

  const project = rows.at(0);

  if (!project?.deadline) {
    throw new HttpError(404, "PROJECT_NOT_FOUND", "Project was not found.");
  }

  return toCountdownHours(project.deadline);
}

async function getNextMilestoneCountdownHours(
  projectId: string,
): Promise<number | null> {
  const rows = await supabaseRestGet<MilestoneRow[]>(
    `tasks?select=due_at&project_id=eq.${encodeURIComponent(projectId)}&status=neq.done&due_at=not.is.null&order=due_at.asc&limit=1`,
  );

  const nextMilestone = rows.at(0);
  if (!nextMilestone) {
    return null;
  }

  return toCountdownHours(nextMilestone.due_at);
}

async function getTeamStatus(
  projectId: string,
): Promise<DashboardSummaryDTO["teamStatus"]> {
  const rows = await supabaseRestGet<TaskStatusRow[]>(
    `tasks?select=status&project_id=eq.${encodeURIComponent(projectId)}`,
  );

  return rows.reduce<DashboardSummaryDTO["teamStatus"]>(
    (accumulator, row) => {
      const normalizedStatus = normalizeTaskStatus(row.status);

      if (normalizedStatus === "in_progress") {
        accumulator.inProgress += 1;
        return accumulator;
      }

      accumulator[normalizedStatus] += 1;
      return accumulator;
    },
    {
      todo: 0,
      inProgress: 0,
      blocked: 0,
      done: 0,
    },
  );
}

export async function getDashboardSummary(
  projectId: string,
  userId: string,
): Promise<DashboardSummaryDTO> {
  const [
    myTasks,
    finalDeadlineCountdownHours,
    nextMilestoneCountdownHours,
    teamStatus,
  ] = await Promise.all([
    getMyTasksReadModel(projectId, userId),
    getFinalDeadlineCountdownHours(projectId),
    getNextMilestoneCountdownHours(projectId),
    getTeamStatus(projectId),
  ]);

  return {
    myTasks,
    finalDeadlineCountdownHours,
    nextMilestoneCountdownHours,
    teamStatus,
  };
}
