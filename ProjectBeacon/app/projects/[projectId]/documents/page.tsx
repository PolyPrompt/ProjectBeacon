import { ProjectDocumentsPage } from "@/components/documents/project-documents-page";
import { requireSessionUser } from "@/lib/auth/session";

type ProjectDocumentsRouteProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectDocumentsRoute({
  params,
}: ProjectDocumentsRouteProps) {
  const { projectId } = await params;
  const sessionUser = await requireSessionUser(
    `/projects/${projectId}/documents`,
  );

  return <ProjectDocumentsPage projectId={projectId} role={sessionUser.role} />;
}
