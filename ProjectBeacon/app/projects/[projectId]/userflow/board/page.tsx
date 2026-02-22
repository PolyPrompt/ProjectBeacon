import { BoardPage } from "@/components/workflow/board-page";
import { requireSessionUser } from "@/lib/auth/session";

type ProjectUserflowBoardRouteProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectUserflowBoardRoute({
  params,
}: ProjectUserflowBoardRouteProps) {
  const { projectId } = await params;
  const sessionUser = await requireSessionUser(
    `/projects/${projectId}/userflow/board`,
    {
      projectId,
    },
  );

  return (
    <BoardPage
      projectId={projectId}
      role={sessionUser.role}
      viewerUserId={sessionUser.userId}
    />
  );
}
