import { WorkspaceClarifyPage } from "@/components/projects/workspace-clarify-page";
import { getWorkspacePageData } from "@/lib/workspace/page-data";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    projectId: string;
  }>;
};

export default async function WorkspaceClarifyRoute({ params }: PageProps) {
  const { projectId } = await params;
  const pageData = await getWorkspacePageData(projectId);

  const projectLeadName =
    pageData.members.find((member) => member.role === "owner")?.name ??
    "Project Lead";

  return (
    <WorkspaceClarifyPage
      initialClarification={pageData.initialClarification}
      initialDescription={pageData.initialDescription}
      initialPlanningStatus={pageData.initialPlanningStatus}
      projectId={projectId}
      projectLeadName={projectLeadName}
    />
  );
}
