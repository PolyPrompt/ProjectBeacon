import { notFound, redirect } from "next/navigation";

import {
  ProjectDashboardShell,
  type DashboardMember,
  type DashboardProject,
  type DashboardTask,
} from "@/components/dashboard/project-dashboard-shell";
import { requireSessionUser } from "@/lib/auth/session";
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
  const supabase = getServiceSupabaseClient();

  const { data: membership, error: membershipError } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", sessionUser.userId)
    .maybeSingle();

  if (membershipError) {
    throw new Error(
      `Failed loading project membership for dashboard access: ${membershipError.message}`,
    );
  }

  if (!membership) {
    notFound();
  }

  // Check if user has added project skills (required before viewing dashboard)
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

  const [projectResult, membersResult, tasksResult] = await Promise.all([
    supabase
      .from("projects")
      .select("id,name,description,deadline,planning_status")
      .eq("id", projectId)
      .maybeSingle(),
    supabase
      .from("project_members")
      .select("user_id,role")
      .eq("project_id", projectId),
    supabase
      .from("tasks")
      .select(
        "id,title,description,status,due_at,difficulty_points,assignee_user_id,created_at",
      )
      .eq("project_id", projectId),
  ]);

  if (projectResult.error) {
    throw new Error(
      `Failed loading dashboard project details: ${projectResult.error.message}`,
    );
  }
  if (!projectResult.data) {
    notFound();
  }

  if (membersResult.error) {
    throw new Error(
      `Failed loading dashboard members: ${membersResult.error.message}`,
    );
  }

  if (tasksResult.error) {
    throw new Error(
      `Failed loading dashboard tasks: ${tasksResult.error.message}`,
    );
  }

  const userIds = membersResult.data.map((member) => member.user_id);
  const { data: users, error: usersError } =
    userIds.length > 0
      ? await supabase.from("users").select("id,name,email").in("id", userIds)
      : { data: [], error: null };

  if (usersError) {
    throw new Error(`Failed loading dashboard users: ${usersError.message}`);
  }

  const usersById = new Map(users.map((user) => [user.id, user]));
  const members: DashboardMember[] = membersResult.data.map((member) => {
    const profile = usersById.get(member.user_id);
    return {
      userId: member.user_id,
      name: profile?.name ?? "Unknown",
      email: profile?.email ?? "",
      role: member.role === "owner" ? "owner" : "member",
      inviteStatus: "accepted",
    };
  });

  const tasks: DashboardTask[] = tasksResult.data.map((task) => ({
    id: task.id,
    title: task.title ?? "Untitled task",
    description: task.description ?? "",
    status:
      task.status === "in_progress" ||
      task.status === "blocked" ||
      task.status === "done"
        ? task.status
        : "todo",
    softDeadline: task.due_at,
    difficultyPoints:
      task.difficulty_points === 1 ||
      task.difficulty_points === 2 ||
      task.difficulty_points === 3 ||
      task.difficulty_points === 5 ||
      task.difficulty_points === 8
        ? task.difficulty_points
        : 3,
    assigneeUserId: task.assignee_user_id,
    createdAt: task.created_at,
  }));

  const project: DashboardProject = {
    id: projectResult.data.id,
    name: projectResult.data.name,
    description: projectResult.data.description ?? "",
    deadline: projectResult.data.deadline,
    planningStatus:
      projectResult.data.planning_status === "assigned" ||
      projectResult.data.planning_status === "locked"
        ? projectResult.data.planning_status
        : "draft",
  };

  return (
    <ProjectDashboardShell
      members={members}
      project={project}
      projectId={projectId}
      tasks={tasks}
      viewerUserId={sessionUser.userId}
    />
  );
}
