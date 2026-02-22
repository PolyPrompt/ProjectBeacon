import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth/session";
import { isE2EAuthBypassEnabled } from "@/lib/auth/e2e-bypass";
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
  const sessionUser = await requireSessionUser(`/projects/${projectId}`, {
    projectId,
  });

  async function signOutAction() {
    "use server";

    redirect("/sign-in");
  }

  return (
    <ProjectNavShell
      onSignOut={signOutAction}
      projectId={projectId}
      role={sessionUser.role}
      useClerkUserButton={!isE2EAuthBypassEnabled()}
      userId={sessionUser.userId}
    >
      {children}
    </ProjectNavShell>
  );
}
