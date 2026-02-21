import type { TaskStatus, TaskRow } from "@/types/planning";

export type ReplanTaskInput = {
  id?: string;
  title: string;
  description: string;
  difficultyPoints: 1 | 2 | 3 | 5 | 8;
  status: TaskStatus;
  dueAt: string | null;
  assigneeUserId?: string | null;
};

export type ReplanPolicyResult = {
  upserts: Array<{
    id?: string;
    title: string;
    description: string;
    difficultyPoints: 1 | 2 | 3 | 5 | 8;
    status: TaskStatus;
    dueAt: string | null;
    assigneeUserId: string | null;
  }>;
  deletedTaskIds: string[];
  preservedTaskIds: string[];
  ignoredTaskIds: string[];
};

export function applyReplanPolicy(
  existingTasks: TaskRow[],
  requestedTasks: ReplanTaskInput[],
): ReplanPolicyResult {
  const existingById = new Map(existingTasks.map((task) => [task.id, task]));
  const preservedTaskIds: string[] = [];
  const ignoredTaskIds: string[] = [];
  const seenIds = new Set<string>();

  const upserts = requestedTasks.map((requested) => {
    if (!requested.id) {
      return {
        ...requested,
        assigneeUserId: requested.assigneeUserId ?? null,
      };
    }

    seenIds.add(requested.id);
    const existing = existingById.get(requested.id);
    if (!existing) {
      return {
        ...requested,
        assigneeUserId: requested.assigneeUserId ?? null,
      };
    }

    if (existing.status === "done") {
      preservedTaskIds.push(existing.id);
      ignoredTaskIds.push(existing.id);
      return {
        id: existing.id,
        title: existing.title,
        description: existing.description,
        difficultyPoints: existing.difficulty_points,
        status: existing.status,
        dueAt: existing.due_at,
        assigneeUserId: existing.assignee_user_id,
      };
    }

    if (existing.status === "in_progress") {
      preservedTaskIds.push(existing.id);
      return {
        id: existing.id,
        title: requested.title,
        description: requested.description,
        difficultyPoints: requested.difficultyPoints,
        status: requested.status,
        dueAt: requested.dueAt,
        assigneeUserId: existing.assignee_user_id,
      };
    }

    return {
      id: existing.id,
      title: requested.title,
      description: requested.description,
      difficultyPoints: requested.difficultyPoints,
      status: requested.status,
      dueAt: requested.dueAt,
      assigneeUserId: requested.assigneeUserId ?? existing.assignee_user_id,
    };
  });

  // Preserve completed/in-progress work even if omitted from request.
  for (const existing of existingTasks) {
    if (seenIds.has(existing.id)) {
      continue;
    }

    if (existing.status === "done" || existing.status === "in_progress") {
      preservedTaskIds.push(existing.id);
      upserts.push({
        id: existing.id,
        title: existing.title,
        description: existing.description,
        difficultyPoints: existing.difficulty_points,
        status: existing.status,
        dueAt: existing.due_at,
        assigneeUserId: existing.assignee_user_id,
      });
    }
  }

  const protectedIds = new Set(
    existingTasks
      .filter((task) => task.status === "done" || task.status === "in_progress")
      .map((task) => task.id),
  );

  const deletedTaskIds = existingTasks
    .filter((task) => !seenIds.has(task.id) && !protectedIds.has(task.id))
    .map((task) => task.id);

  return {
    upserts,
    deletedTaskIds,
    preservedTaskIds: [...new Set(preservedTaskIds)],
    ignoredTaskIds: [...new Set(ignoredTaskIds)],
  };
}
