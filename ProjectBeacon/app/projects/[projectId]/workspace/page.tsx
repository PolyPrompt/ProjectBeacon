import PlanningWorkspace from "@/components/projects/planning-workspace";
import { requireSessionUser } from "@/lib/auth/session";

type WorkspacePageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const { projectId } = await params;
  const sessionUser = await requireSessionUser(
    `/projects/${projectId}/workspace`,
  );

  return (
    <PlanningWorkspace
      projectId={projectId}
      userIdHeaderValue={sessionUser.userId}
    />
  );
}
