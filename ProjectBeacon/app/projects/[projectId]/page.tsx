import { notFound, redirect } from "next/navigation";

import {
  ProjectDashboardShell,
  type DashboardMember,
  type DashboardProject,
  type DashboardTask,
} from "@/components/dashboard/project-dashboard-shell";
import { requireSessionUser, type ProjectRole } from "@/lib/auth/session";
import { getServiceSupabaseClient } from "@/lib/supabase/server";

type ProjectDashboardPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectDashboardPage({
  params,
}: ProjectDashboardPageProps) {
  const { projectId } = await params;
  const sessionUser = await requireSessionUser(`/projects/${projectId}`, {
    projectId,
  });

  // Check if user has added project skills (required before viewing dashboard)
  const supabase = getServiceSupabaseClient();
  const { data: existingProjectSkill, error: existingProjectSkillError } =
    await supabase
      .from("project_member_skills")
      .select("skill_id")
      .eq("project_id", projectId)
      .eq("user_id", sessionUser.userId)
      .limit(1)
      .maybeSingle();

  if (existingProjectSkillError) {
    throw new Error(
      `Failed checking project skills for dashboard access: ${existingProjectSkillError.message}`,
    );
  }

  if (!existingProjectSkill) {
    redirect(`/projects/${projectId}/skills`);
  }

  let data: unknown;
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/projects/${projectId}/dashboard`,
      {
        headers: {
          "x-user-id": sessionUser.userId,
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      if (response.status === 404) {
        notFound();
      }

      redirect(`/projects/${projectId}/skills`);
    }

    data = await response.json();
  } catch {
    redirect(`/projects/${projectId}/skills`);
  }

  const payload = data as {
    members?: DashboardMember[];
    project?: DashboardProject;
    tasks?: DashboardTask[];
    role?: ProjectRole;
  };

  if (
    !Array.isArray(payload.members) ||
    !payload.project ||
    !Array.isArray(payload.tasks) ||
    !payload.role
  ) {
    redirect(`/projects/${projectId}/skills`);
  }

  return (
    <ProjectDashboardShell
      members={payload.members}
      project={payload.project}
      projectId={projectId}
      tasks={payload.tasks}
      viewerRole={payload.role}
      viewerUserId={sessionUser.userId}
    />
  );
}
