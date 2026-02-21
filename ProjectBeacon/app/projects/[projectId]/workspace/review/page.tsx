import { WorkspaceReviewPage } from "@/components/projects/workspace-review-page";
import { getWorkspacePageData } from "@/lib/workspace/page-data";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    projectId: string;
  }>;
};

export default async function WorkspaceReviewRoute({ params }: PageProps) {
  const { projectId } = await params;
  const pageData = await getWorkspacePageData(projectId);

  return (
    <WorkspaceReviewPage
      initialClarification={pageData.initialClarification}
      initialDescription={pageData.initialDescription}
      initialPlanningStatus={pageData.initialPlanningStatus}
      projectId={projectId}
      projectName={pageData.project.name}
    />
  );
}
