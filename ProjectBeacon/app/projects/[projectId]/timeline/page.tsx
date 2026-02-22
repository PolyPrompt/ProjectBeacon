import { redirect } from "next/navigation";

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
  if (typeof taskId === "string" && taskId.length > 0) {
    redirect(
      `/projects/${projectId}/userflow/timeline?taskId=${encodeURIComponent(taskId)}`,
    );
  }
  redirect(`/projects/${projectId}/userflow/timeline`);
}
