import { TimelinePage } from "@/components/workflow/timeline-page";
import { requireSessionUser } from "@/lib/auth/session";

type ProjectUserflowTimelineRouteProps = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ taskId?: string }>;
};

export default async function ProjectUserflowTimelineRoute({
  params,
  searchParams,
}: ProjectUserflowTimelineRouteProps) {
  const { projectId } = await params;
  const { taskId } = await searchParams;
  const sessionUser = await requireSessionUser(
    `/projects/${projectId}/userflow/timeline`,
    {
      projectId,
    },
  );

  return (
    <TimelinePage
      projectId={projectId}
      role={sessionUser.role}
      selectedTaskId={typeof taskId === "string" ? taskId : null}
    />
  );
}
