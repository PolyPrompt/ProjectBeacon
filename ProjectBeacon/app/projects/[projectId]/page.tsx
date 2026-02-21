import { ProjectDashboardShell } from "@/components/dashboard/project-dashboard-shell";
import { getDashboardPageData } from "@/lib/workspace/page-data";

type ProjectDashboardPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectDashboardPage({
  params,
}: ProjectDashboardPageProps) {
  const { projectId } = await params;
  const pageData = await getDashboardPageData(projectId);

  return <ProjectDashboardShell initialData={pageData} projectId={projectId} />;
}
