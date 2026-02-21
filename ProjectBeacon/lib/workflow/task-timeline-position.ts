export type TimelinePhase = "beginning" | "middle" | "end";
export type DueDatePlacement = "early" | "mid" | "late" | "unscheduled";

export type TimelinePlacement = {
  phase: TimelinePhase;
  sequenceIndex: number;
  totalTasks: number;
};

export type TimelineTaskInput = {
  id: string;
  dueAt: string | null;
  createdAt: string | null;
};

export type TaskDependencyInput = {
  taskId: string;
  dependsOnTaskId: string;
};

function toTimestamp(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return fallback;
  }

  return timestamp;
}

function compareTasks(a: TimelineTaskInput, b: TimelineTaskInput): number {
  const aDue = toTimestamp(a.dueAt, Number.POSITIVE_INFINITY);
  const bDue = toTimestamp(b.dueAt, Number.POSITIVE_INFINITY);

  if (aDue !== bDue) {
    return aDue - bDue;
  }

  const aCreated = toTimestamp(a.createdAt, Number.POSITIVE_INFINITY);
  const bCreated = toTimestamp(b.createdAt, Number.POSITIVE_INFINITY);

  if (aCreated !== bCreated) {
    return aCreated - bCreated;
  }

  return a.id.localeCompare(b.id);
}

export function orderTasksByDependency(
  tasks: TimelineTaskInput[],
  dependencies: TaskDependencyInput[],
): string[] {
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const incomingCount = new Map<string, number>();
  const outgoing = new Map<string, string[]>();

  for (const task of tasks) {
    incomingCount.set(task.id, 0);
    outgoing.set(task.id, []);
  }

  for (const dependency of dependencies) {
    if (
      !taskMap.has(dependency.taskId) ||
      !taskMap.has(dependency.dependsOnTaskId)
    ) {
      continue;
    }

    incomingCount.set(
      dependency.taskId,
      (incomingCount.get(dependency.taskId) ?? 0) + 1,
    );
    outgoing.get(dependency.dependsOnTaskId)?.push(dependency.taskId);
  }

  const queue = tasks
    .filter((task) => (incomingCount.get(task.id) ?? 0) === 0)
    .sort(compareTasks);

  const orderedIds: string[] = [];

  while (queue.length > 0) {
    const nextTask = queue.shift();
    if (!nextTask) {
      break;
    }

    orderedIds.push(nextTask.id);

    const dependents = outgoing.get(nextTask.id) ?? [];
    for (const dependentId of dependents) {
      const nextIncoming = (incomingCount.get(dependentId) ?? 0) - 1;
      incomingCount.set(dependentId, nextIncoming);

      if (nextIncoming === 0) {
        const dependentTask = taskMap.get(dependentId);
        if (dependentTask) {
          queue.push(dependentTask);
          queue.sort(compareTasks);
        }
      }
    }
  }

  if (orderedIds.length === tasks.length) {
    return orderedIds;
  }

  const unresolvedIds = tasks
    .filter((task) => !orderedIds.includes(task.id))
    .sort(compareTasks)
    .map((task) => task.id);

  return [...orderedIds, ...unresolvedIds];
}

function toPhase(sequenceIndex: number, totalTasks: number): TimelinePhase {
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

export function getTimelinePlacement(
  taskId: string,
  tasks: TimelineTaskInput[],
  dependencies: TaskDependencyInput[],
): TimelinePlacement {
  const orderedTaskIds = orderTasksByDependency(tasks, dependencies);
  const sequenceIndex = Math.max(orderedTaskIds.indexOf(taskId), 0);
  const totalTasks = orderedTaskIds.length;

  return {
    phase: toPhase(sequenceIndex, totalTasks),
    sequenceIndex,
    totalTasks,
  };
}

export function getDueDatePlacement(
  taskDueAt: string | null,
  projectCreatedAt: string | null,
  projectDeadline: string | null,
): DueDatePlacement {
  if (!taskDueAt) {
    return "unscheduled";
  }

  const dueAt = new Date(taskDueAt).getTime();
  const createdAt = new Date(projectCreatedAt ?? "").getTime();
  const deadlineAt = new Date(projectDeadline ?? "").getTime();

  if (
    Number.isNaN(dueAt) ||
    Number.isNaN(createdAt) ||
    Number.isNaN(deadlineAt) ||
    deadlineAt <= createdAt
  ) {
    return "unscheduled";
  }

  const ratio = Math.min(
    Math.max((dueAt - createdAt) / (deadlineAt - createdAt), 0),
    1,
  );

  if (ratio < 1 / 3) {
    return "early";
  }

  if (ratio < 2 / 3) {
    return "mid";
  }

  return "late";
}
