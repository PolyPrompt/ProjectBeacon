import { redirect } from "next/navigation";

type ProjectUserflowRouteProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectUserflowRoute({
  params,
}: ProjectUserflowRouteProps) {
  const { projectId } = await params;
  redirect(`/projects/${projectId}/userflow/board`);
}
