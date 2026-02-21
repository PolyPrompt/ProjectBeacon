import { ProjectDashboardShell } from "@/components/dashboard/project-dashboard-shell";
import { getWorkspacePageData } from "@/lib/workspace/page-data";
import { ProjectDashboardViewModel } from "@/types/dashboard";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    projectId: string;
  }>;
};

export default async function ProjectDashboardPage({ params }: PageProps) {
  const { projectId } = await params;
  const pageData = await getWorkspacePageData(projectId);

  const initialViewModel: ProjectDashboardViewModel = {
    project: pageData.project,
    members: pageData.members,
    tasks: [],
    dependencyEdges: [],
  };

  return (
    <main className="min-h-screen bg-[#0a0911] bg-[radial-gradient(circle_at_top,#1d1230_0%,#0a0911_55%)] px-4 py-8 text-slate-100 md:px-10">
      <div className="mx-auto max-w-7xl">
        <ProjectDashboardShell
          initialClarification={pageData.initialClarification}
          initialViewModel={initialViewModel}
        />
      </div>
    </main>
  );
}
