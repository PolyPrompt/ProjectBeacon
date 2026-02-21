import { BoardPage } from "@/components/workflow/board-page";
import { requireSessionUser } from "@/lib/auth/session";

type ProjectBoardRouteProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectBoardRoute({
  params,
}: ProjectBoardRouteProps) {
  const { projectId } = await params;
  const sessionUser = await requireSessionUser(`/projects/${projectId}/board`);

  return <BoardPage projectId={projectId} role={sessionUser.role} />;
}
