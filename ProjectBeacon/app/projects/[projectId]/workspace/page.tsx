import { ProjectDocumentsWorkflowPage } from "@/components/projects/project-documents-workflow-page";

type WorkspacePageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const { projectId } = await params;

  return <ProjectDocumentsWorkflowPage projectId={projectId} />;
}
