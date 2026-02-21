import { redirect } from "next/navigation";

import { ProjectNavShell } from "@/components/navigation/project-nav-shell";
import { normalizeProjectRole } from "@/lib/auth/project-role";
import { requireSessionUser } from "@/lib/auth/clerk-auth";
import {
  getProjectMembership,
  resolveActorUserId,
} from "@/lib/projects/membership";
import { getServiceSupabaseClient } from "@/lib/supabase/server";

type ProjectLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
};

export default async function ProjectLayout({
  children,
  params,
}: ProjectLayoutProps) {
  const { projectId } = await params;
  const sessionUser = await requireSessionUser({ redirectToSignIn: true });
  const supabase = getServiceSupabaseClient();

  const actorUserId = await resolveActorUserId(supabase, sessionUser);
  if (!actorUserId) {
    redirect("/sign-in");
  }

  const membership = await getProjectMembership(
    supabase,
    projectId,
    actorUserId,
  );
  const role = normalizeProjectRole(membership?.role);

  if (!role) {
    redirect("/projects/new");
  }

  return (
    <ProjectNavShell projectId={projectId} role={role} userId={actorUserId}>
      {children}
    </ProjectNavShell>
  );
}
