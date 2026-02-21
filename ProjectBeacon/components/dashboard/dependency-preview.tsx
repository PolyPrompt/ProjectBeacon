import { DependencyEdge, ProjectTask } from "@/types/dashboard";

type DependencyPreviewProps = {
  tasks: ProjectTask[];
  dependencyEdges: DependencyEdge[];
};

export function DependencyPreview({ tasks, dependencyEdges }: DependencyPreviewProps) {
  const taskNameById = new Map(tasks.map((task) => [task.id, task.title]));

  return (
    <section className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">Dependency Preview</h2>
        <span className="text-xs font-medium text-slate-500">{dependencyEdges.length} links</span>
      </div>

      {dependencyEdges.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
          No dependencies defined yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {dependencyEdges.map((edge) => (
            <li className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700" key={`${edge.taskId}-${edge.dependsOnTaskId}`}>
              {(taskNameById.get(edge.dependsOnTaskId) ?? edge.dependsOnTaskId) +
                " -> " +
                (taskNameById.get(edge.taskId) ?? edge.taskId)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
