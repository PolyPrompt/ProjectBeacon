import { ClarificationCheckpointPage } from "@/components/projects/clarification-checkpoint-page";
import { requireSessionUser } from "@/lib/auth/session";

type ProjectClarificationPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectClarificationPage({
  params,
}: ProjectClarificationPageProps) {
  const { projectId } = await params;
  await requireSessionUser(`/projects/${projectId}/clarification`, {
    projectId,
  });

  return <ClarificationCheckpointPage projectId={projectId} />;
}
