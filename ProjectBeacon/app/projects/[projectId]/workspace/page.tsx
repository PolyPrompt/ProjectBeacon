import PlanningWorkspace from "@/components/projects/planning-workspace";

type WorkspacePageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const { projectId } = await params;

  return <PlanningWorkspace projectId={projectId} />;
}
