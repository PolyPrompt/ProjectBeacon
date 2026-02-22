export function isProjectComplete(taskStatuses: readonly string[]): boolean {
  if (taskStatuses.length === 0) {
    return false;
  }

  return taskStatuses.every((status) => status.trim().toLowerCase() === "done");
}
