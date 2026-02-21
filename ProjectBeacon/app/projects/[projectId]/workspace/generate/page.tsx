import { WorkspaceGeneratePage } from "@/components/projects/workspace-generate-page";
import { getWorkspacePageData } from "@/lib/workspace/page-data";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    projectId: string;
  }>;
};

export default async function WorkspaceGenerateRoute({ params }: PageProps) {
  const { projectId } = await params;
  const pageData = await getWorkspacePageData(projectId);

  return (
    <WorkspaceGeneratePage
      initialClarification={pageData.initialClarification}
      initialDescription={pageData.initialDescription}
      initialPlanningStatus={pageData.initialPlanningStatus}
      projectId={projectId}
    />
  );
}
