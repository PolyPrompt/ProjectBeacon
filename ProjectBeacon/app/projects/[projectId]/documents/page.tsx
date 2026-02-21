import { redirect } from "next/navigation";

import { ProjectDocumentsPage } from "@/components/documents/project-documents-page";
import { normalizeProjectRole } from "@/lib/auth/project-role";
import { requireSessionUser } from "@/lib/auth/clerk-auth";
import {
  getProjectMembership,
  resolveActorUserId,
} from "@/lib/projects/membership";
import { getServiceSupabaseClient } from "@/lib/supabase/server";

type ProjectDocumentsRouteProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectDocumentsRoute({
  params,
}: ProjectDocumentsRouteProps) {
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

  return <ProjectDocumentsPage projectId={projectId} role={role} />;
}
