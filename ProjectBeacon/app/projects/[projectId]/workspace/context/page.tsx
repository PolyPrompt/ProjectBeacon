import { WorkspaceContextPage } from "@/components/projects/workspace-context-page";
import { getWorkspacePageData } from "@/lib/workspace/page-data";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    projectId: string;
  }>;
};

export default async function WorkspaceContextRoute({ params }: PageProps) {
  const { projectId } = await params;
  const pageData = await getWorkspacePageData(projectId);

  return (
    <WorkspaceContextPage
      initialClarification={pageData.initialClarification}
      initialDescription={pageData.initialDescription}
      initialPlanningStatus={pageData.initialPlanningStatus}
      projectId={projectId}
      projectName={pageData.project.name}
    />
  );
}
