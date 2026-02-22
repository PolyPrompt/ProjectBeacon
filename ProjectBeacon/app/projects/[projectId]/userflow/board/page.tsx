import { redirect } from "next/navigation";
import { BoardPage } from "@/components/workflow/board-page";
import { requireSessionUser } from "@/lib/auth/session";
import { isProjectComplete } from "@/lib/projects/completion";
import { getServiceSupabaseClient } from "@/lib/supabase/server";

type ProjectUserflowBoardRouteProps = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ view?: string }>;
};

export default async function ProjectUserflowBoardRoute({
  params,
  searchParams,
}: ProjectUserflowBoardRouteProps) {
  const { projectId } = await params;
  const { view } = await searchParams;
  const sessionUser = await requireSessionUser(
    `/projects/${projectId}/userflow/board`,
    {
      projectId,
    },
  );
  const allowCompletedView = view === "completed";

  if (!allowCompletedView) {
    const supabase = getServiceSupabaseClient();
    const { data: completionRows, error: completionError } = await supabase
      .from("tasks")
      .select("status")
      .eq("project_id", projectId)
      .returns<Array<{ status: string | null }>>();

    if (completionError) {
      throw new Error(
        `Failed loading task completion state for board: ${completionError.message}`,
      );
    }

    if (
      isProjectComplete((completionRows ?? []).map((task) => task.status ?? ""))
    ) {
      redirect(`/projects/${projectId}/complete`);
    }
  }

  return (
    <BoardPage
      projectId={projectId}
      role={sessionUser.role}
      showProjectSummaryLink={allowCompletedView}
      viewerUserId={sessionUser.userId}
    />
  );
}
