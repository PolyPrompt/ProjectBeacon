type DependencyPreviewProps = {
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    assigneeUserId: string | null;
    difficultyPoints: 1 | 2 | 3 | 5 | 8;
  }>;
  dependencyEdges: Array<{ taskId: string; dependsOnTaskId: string }>;
};

export function DependencyPreview({
  tasks,
  dependencyEdges,
}: DependencyPreviewProps) {
  const taskTitleById = new Map(tasks.map((task) => [task.id, task.title]));

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">
        Dependency Preview
      </h2>

      {dependencyEdges.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
          No dependency links yet.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {dependencyEdges.map((edge) => {
            const fromTitle =
              taskTitleById.get(edge.dependsOnTaskId) ?? edge.dependsOnTaskId;
            const toTitle = taskTitleById.get(edge.taskId) ?? edge.taskId;

            return (
              <li
                key={`${edge.taskId}:${edge.dependsOnTaskId}`}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
              >
                {fromTitle} -&gt; {toTitle}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
