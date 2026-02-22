import { TaskInventoryWorkflowPage } from "@/components/projects/task-inventory-workflow-page";
import { requireSessionUser } from "@/lib/auth/session";

type ProjectInventoryPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectInventoryPage({
  params,
}: ProjectInventoryPageProps) {
  const { projectId } = await params;
  await requireSessionUser(`/projects/${projectId}/inventory`, {
    projectId,
  });

  return <TaskInventoryWorkflowPage projectId={projectId} />;
}
