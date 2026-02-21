export type DependencyEdge<TTaskId extends string = string> = {
  taskId: TTaskId;
  dependsOnTaskId: TTaskId;
};

export type DependencyValidationResult =
  | {
      ok: true;
      topologicalOrder: string[];
    }
  | {
      ok: false;
      reason: "SELF_DEPENDENCY" | "UNKNOWN_TASK" | "DUPLICATE_EDGE" | "CYCLE";
      edge?: DependencyEdge;
    };

export function validateDependencyGraph(
  taskIds: string[],
  edges: DependencyEdge[],
): DependencyValidationResult {
  const taskIdSet = new Set(taskIds);
  const edgeSet = new Set<string>();

  for (const edge of edges) {
    if (edge.taskId === edge.dependsOnTaskId) {
      return { ok: false, reason: "SELF_DEPENDENCY", edge };
    }

    if (!taskIdSet.has(edge.taskId) || !taskIdSet.has(edge.dependsOnTaskId)) {
      return { ok: false, reason: "UNKNOWN_TASK", edge };
    }

    const key = `${edge.taskId}->${edge.dependsOnTaskId}`;
    if (edgeSet.has(key)) {
      return { ok: false, reason: "DUPLICATE_EDGE", edge };
    }
    edgeSet.add(key);
  }

  const inDegree = new Map<string, number>(
    taskIds.map((taskId) => [taskId, 0]),
  );
  const adjacency = new Map<string, string[]>(
    taskIds.map((taskId) => [taskId, []]),
  );

  for (const edge of edges) {
    // Finish-to-start means dependency direction is depends_on -> task.
    adjacency.get(edge.dependsOnTaskId)?.push(edge.taskId);
    inDegree.set(edge.taskId, (inDegree.get(edge.taskId) ?? 0) + 1);
  }

  const queue = [
    ...taskIds.filter((taskId) => (inDegree.get(taskId) ?? 0) === 0),
  ].sort();
  const order: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      break;
    }
    order.push(current);

    const neighbors = adjacency.get(current) ?? [];
    for (const next of neighbors) {
      const nextDegree = (inDegree.get(next) ?? 0) - 1;
      inDegree.set(next, nextDegree);
      if (nextDegree === 0) {
        queue.push(next);
      }
    }

    queue.sort();
  }

  if (order.length !== taskIds.length) {
    return { ok: false, reason: "CYCLE" };
  }

  return { ok: true, topologicalOrder: order };
}
