import Link from "next/link";

type WorkspacePageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const { projectId } = await params;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold text-slate-900">Workspace</h1>
      <p className="mt-2 text-sm text-slate-600">
        Planning workspace routes remain available, while post-onboarding
        navigation now lives in the top bar.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700"
          href={`/projects/${projectId}`}
        >
          Go to Dashboard
        </Link>
        <Link
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          href={`/projects/${projectId}/board`}
        >
          Open Board
        </Link>
      </div>
    </section>
  );
}
