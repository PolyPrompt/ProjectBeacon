import TaskInventoryStandalonePage from "@/components/projects/task-inventory-standalone-page";
import { requireSessionUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";

type ProjectInventoryPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectInventoryPage({
  params,
}: ProjectInventoryPageProps) {
  const { projectId } = await params;
  const sessionUser = await requireSessionUser(
    `/projects/${projectId}/inventory`,
    {
      projectId,
    },
  );

  if (sessionUser.role !== "admin") {
    redirect(`/projects/${projectId}`);
  }

  return <TaskInventoryStandalonePage projectId={projectId} />;
}
