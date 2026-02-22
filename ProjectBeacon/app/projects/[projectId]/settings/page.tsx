import { ProjectSettingsPage } from "@/components/settings/project-settings-page";
import { requireSessionUser } from "@/lib/auth/session";

type ProjectSettingsRouteProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectSettingsRoute({
  params,
}: ProjectSettingsRouteProps) {
  const { projectId } = await params;
  const sessionUser = await requireSessionUser(
    `/projects/${projectId}/settings`,
    {
      projectId,
    },
  );

  return <ProjectSettingsPage projectId={projectId} role={sessionUser.role} />;
}
