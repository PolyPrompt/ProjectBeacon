import { redirect } from "next/navigation";
import { clearLocalSession, requireSessionUser } from "@/lib/auth/session";
import { ProjectNavShell } from "@/components/navigation/project-nav-shell";

type ProjectLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
};

export default async function ProjectLayout({
  children,
  params,
}: ProjectLayoutProps) {
  const { projectId } = await params;
  const sessionUser = await requireSessionUser(`/projects/${projectId}`);

  async function signOutAction() {
    "use server";

    await clearLocalSession();
    redirect("/sign-in");
  }

  return (
    <ProjectNavShell
      onSignOut={signOutAction}
      projectId={projectId}
      role={sessionUser.role}
      userId={sessionUser.userId}
    >
      {children}
    </ProjectNavShell>
  );
}
