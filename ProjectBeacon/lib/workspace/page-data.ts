import { headers } from "next/headers";
import type {
  DashboardSummaryDTO,
  MyTaskDTO,
  TaskStatus,
} from "@/types/dashboard";

type DashboardApiPayload = {
  myTasks?: MyTaskDTO[];
  finalDeadlineCountdownHours?: number;
  nextMilestoneCountdownHours?: number | null;
  teamStatus?: {
    todo?: number;
    inProgress?: number;
    blocked?: number;
    done?: number;
  };
};

type MyTasksApiPayload = {
  myTasks?: MyTaskDTO[];
  tasks?: MyTaskDTO[];
};

export type DashboardPageData = {
  summary: DashboardSummaryDTO;
  source: "api" | "scaffold";
  notices: string[];
};

const FALLBACK_TASKS: MyTaskDTO[] = [
  {
    id: "t_scaffold_1",
    title: "Wire dashboard shell to APIs",
    description:
      "Replace scaffold data with live dashboard endpoints once available.",
    status: "in_progress",
    softDeadline: new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString(),
    difficultyPoints: 3,
  },
  {
    id: "t_scaffold_2",
    title: "Validate modal timeline deep-link",
    description: "Ensure dashboard task modal opens timeline at selected task.",
    status: "todo",
    softDeadline: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    difficultyPoints: 2,
  },
];

function isTaskStatus(value: unknown): value is TaskStatus {
  return (
    value === "todo" ||
    value === "in_progress" ||
    value === "blocked" ||
    value === "done"
  );
}

function isDifficulty(value: unknown): value is 1 | 2 | 3 | 5 | 8 {
  return (
    value === 1 || value === 2 || value === 3 || value === 5 || value === 8
  );
}

function sanitizeTask(raw: unknown): MyTaskDTO | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const task = raw as Record<string, unknown>;
  if (
    typeof task.id !== "string" ||
    typeof task.title !== "string" ||
    typeof task.description !== "string" ||
    !isTaskStatus(task.status) ||
    !isDifficulty(task.difficultyPoints)
  ) {
    return null;
  }

  const softDeadline =
    typeof task.softDeadline === "string" ? task.softDeadline : null;

  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    softDeadline,
    difficultyPoints: task.difficultyPoints,
  };
}

function sortTasks(tasks: MyTaskDTO[]): MyTaskDTO[] {
  return [...tasks].sort((left, right) => {
    if (!left.softDeadline && !right.softDeadline) {
      return 0;
    }
    if (!left.softDeadline) {
      return 1;
    }
    if (!right.softDeadline) {
      return -1;
    }

    return (
      new Date(left.softDeadline).getTime() -
      new Date(right.softDeadline).getTime()
    );
  });
}

function summarizeTeamStatus(
  tasks: MyTaskDTO[],
): DashboardSummaryDTO["teamStatus"] {
  const initial = { todo: 0, inProgress: 0, blocked: 0, done: 0 };

  for (const task of tasks) {
    if (task.status === "todo") {
      initial.todo += 1;
    }
    if (task.status === "in_progress") {
      initial.inProgress += 1;
    }
    if (task.status === "blocked") {
      initial.blocked += 1;
    }
    if (task.status === "done") {
      initial.done += 1;
    }
  }

  return initial;
}

async function resolveBaseUrl(): Promise<string> {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL;
  if (envUrl) {
    return envUrl.startsWith("http") ? envUrl : `https://${envUrl}`;
  }

  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const proto = requestHeaders.get("x-forwarded-proto") ?? "http";

  if (host) {
    return `${proto}://${host}`;
  }

  return "http://localhost:3000";
}

async function getJson(
  path: string,
): Promise<{ ok: boolean; data: unknown; message?: string }> {
  try {
    const baseUrl = await resolveBaseUrl();
    const response = await fetch(`${baseUrl}${path}`, { cache: "no-store" });

    if (!response.ok) {
      return {
        ok: false,
        data: null,
        message: `${path} returned ${response.status}`,
      };
    }

    const data = (await response.json()) as unknown;
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      data: null,
      message:
        error instanceof Error
          ? error.message
          : "Unknown dashboard fetch error",
    };
  }
}

export async function getDashboardPageData(
  projectId: string,
): Promise<DashboardPageData> {
  const notices: string[] = [];

  const [dashboardResponse, myTasksResponse] = await Promise.all([
    getJson(`/api/projects/${projectId}/dashboard`),
    getJson(`/api/projects/${projectId}/tasks/my`),
  ]);

  if (!dashboardResponse.ok && dashboardResponse.message) {
    notices.push(dashboardResponse.message);
  }
  if (!myTasksResponse.ok && myTasksResponse.message) {
    notices.push(myTasksResponse.message);
  }

  const dashboardPayload = (dashboardResponse.data ??
    {}) as DashboardApiPayload;
  const myTasksPayload = (myTasksResponse.data ?? {}) as MyTasksApiPayload;

  const rawTasks =
    (Array.isArray(myTasksPayload.myTasks) && myTasksPayload.myTasks) ||
    (Array.isArray(myTasksPayload.tasks) && myTasksPayload.tasks) ||
    (Array.isArray(dashboardPayload.myTasks) && dashboardPayload.myTasks) ||
    [];

  const normalizedTasks = sortTasks(
    rawTasks
      .map(sanitizeTask)
      .filter((task): task is MyTaskDTO => Boolean(task)),
  );

  if (normalizedTasks.length === 0) {
    const fallbackSummary: DashboardSummaryDTO = {
      myTasks: sortTasks(FALLBACK_TASKS),
      finalDeadlineCountdownHours: 240,
      nextMilestoneCountdownHours: 36,
      teamStatus: summarizeTeamStatus(FALLBACK_TASKS),
    };

    return {
      summary: fallbackSummary,
      source: "scaffold",
      notices: notices.length
        ? notices
        : [
            "Dashboard APIs unavailable. Showing scaffold data until backend endpoints are ready.",
          ],
    };
  }

  const finalHours =
    typeof dashboardPayload.finalDeadlineCountdownHours === "number"
      ? dashboardPayload.finalDeadlineCountdownHours
      : Math.max(
          0,
          Math.round(
            (new Date(
              normalizedTasks.at(-1)?.softDeadline ?? Date.now(),
            ).getTime() -
              Date.now()) /
              3_600_000,
          ),
        );

  const nextHours =
    typeof dashboardPayload.nextMilestoneCountdownHours === "number" ||
    dashboardPayload.nextMilestoneCountdownHours === null
      ? dashboardPayload.nextMilestoneCountdownHours
      : normalizedTasks[0]?.softDeadline
        ? Math.max(
            0,
            Math.round(
              (new Date(normalizedTasks[0].softDeadline).getTime() -
                Date.now()) /
                3_600_000,
            ),
          )
        : null;

  const teamStatus = dashboardPayload.teamStatus
    ? {
        todo: Number(dashboardPayload.teamStatus.todo ?? 0),
        inProgress: Number(dashboardPayload.teamStatus.inProgress ?? 0),
        blocked: Number(dashboardPayload.teamStatus.blocked ?? 0),
        done: Number(dashboardPayload.teamStatus.done ?? 0),
      }
    : summarizeTeamStatus(normalizedTasks);

  return {
    summary: {
      myTasks: normalizedTasks,
      finalDeadlineCountdownHours: finalHours,
      nextMilestoneCountdownHours: nextHours,
      teamStatus,
    },
    source: notices.length ? "scaffold" : "api",
    notices,
  };
}
