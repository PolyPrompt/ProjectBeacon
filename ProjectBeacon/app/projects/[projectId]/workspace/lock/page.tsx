import { WorkspaceLockPage } from "@/components/projects/workspace-lock-page";
import { getWorkspacePageData } from "@/lib/workspace/page-data";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    projectId: string;
  }>;
};

export default async function WorkspaceLockRoute({ params }: PageProps) {
  const { projectId } = await params;
  const pageData = await getWorkspacePageData(projectId);

  return (
    <WorkspaceLockPage
      initialClarification={pageData.initialClarification}
      initialDescription={pageData.initialDescription}
      initialPlanningStatus={pageData.initialPlanningStatus}
      projectId={projectId}
    />
  );
}
