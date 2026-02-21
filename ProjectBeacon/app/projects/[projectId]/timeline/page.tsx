import { TimelinePage } from "@/components/workflow/timeline-page";
import { requireSessionUser } from "@/lib/auth/session";

type ProjectTimelineRouteProps = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ taskId?: string }>;
};

export default async function ProjectTimelineRoute({
  params,
  searchParams,
}: ProjectTimelineRouteProps) {
  const { projectId } = await params;
  const { taskId } = await searchParams;
  const sessionUser = await requireSessionUser(
    `/projects/${projectId}/timeline`,
  );

  return (
    <TimelinePage
      projectId={projectId}
      role={sessionUser.role}
      selectedTaskId={typeof taskId === "string" ? taskId : null}
    />
  );
}
