import { notFound, redirect } from "next/navigation";

import {
  ProjectDashboardShell,
  type DashboardMember,
  type DashboardProject,
  type DashboardTask,
} from "@/components/dashboard/project-dashboard-shell";
import { requireSessionUser, type ProjectRole } from "@/lib/auth/session";
import { getServiceSupabaseClient } from "@/lib/supabase/server";
import type { TaskStatus } from "@/types/dashboard";

type ProjectDashboardPageProps = {
  params: Promise<{ projectId: string }>;
};

type ProjectRow = {
  id: string;
  name: string;
  description: string;
  deadline: string | null;
  planning_status: string;
};

type MemberRow = {
  user_id: string;
  role: string;
};

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  due_at: string | null;
  difficulty_points: number | null;
  assignee_user_id: string | null;
  created_at: string | null;
};

type UserRow = {
  id: string;
  name: string | null;
  email: string;
};

function normalizePlanningStatus(
  value: string,
): DashboardProject["planningStatus"] {
  if (value === "locked") {
    return "locked";
  }
  if (value === "assigned") {
    return "assigned";
  }
  return "draft";
}

function normalizeDifficultyPoints(value: number | null): 1 | 2 | 3 | 5 | 8 {
  if (value === 1 || value === 2 || value === 3 || value === 5 || value === 8) {
    return value;
  }
  return 3;
}

function normalizeMemberRole(value: string): DashboardMember["role"] {
  if (value === "owner" || value === "admin") {
    return "owner";
  }
  return "member";
}

function normalizeTaskStatus(value: string): TaskStatus {
  if (
    value === "todo" ||
    value === "in_progress" ||
    value === "blocked" ||
    value === "done"
  ) {
    return value;
  }

  return "todo";
}

async function getProjectDashboardData(
  projectId: string,
  userId: string,
): Promise<{
  project: DashboardProject;
  members: DashboardMember[];
  tasks: DashboardTask[];
  role: ProjectRole;
} | null> {
  const supabase = getServiceSupabaseClient();

  const { data: membership, error: membershipError } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (membershipError || !membership) {
    return null;
  }

  const [projectResponse, membersResponse, tasksResponse] = await Promise.all([
    supabase
      .from("projects")
      .select("id,name,description,deadline,planning_status")
      .eq("id", projectId)
      .maybeSingle<ProjectRow>(),
    supabase
      .from("project_members")
      .select("user_id,role")
      .eq("project_id", projectId)
      .returns<MemberRow[]>(),
    supabase
      .from("tasks")
      .select(
        "id,title,description,status,due_at,difficulty_points,assignee_user_id,created_at",
      )
      .eq("project_id", projectId)
      .returns<TaskRow[]>(),
  ]);

  if (
    projectResponse.error ||
    !projectResponse.data ||
    membersResponse.error ||
    tasksResponse.error
  ) {
    return null;
  }

  const members = membersResponse.data ?? [];

  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("id,name,email")
    .in(
      "id",
      members.length > 0
        ? members.map((member) => member.user_id)
        : ["00000000-0000-0000-0000-000000000000"],
    )
    .returns<UserRow[]>();

  if (usersError) {
    return null;
  }

  const usersById = new Map((users ?? []).map((entry) => [entry.id, entry]));

  return {
    project: {
      id: projectResponse.data.id,
      name: projectResponse.data.name,
      description: projectResponse.data.description,
      deadline: projectResponse.data.deadline,
      planningStatus: normalizePlanningStatus(
        projectResponse.data.planning_status,
      ),
    },
    members: members.map((member) => {
      const profile = usersById.get(member.user_id);

      return {
        userId: member.user_id,
        name: profile?.name?.trim() || profile?.email || "Unknown member",
        email: profile?.email || "",
        role: normalizeMemberRole(member.role),
        inviteStatus: "accepted",
      };
    }),
    tasks: (tasksResponse.data ?? []).map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description ?? "",
      status: normalizeTaskStatus(task.status),
      softDeadline: task.due_at,
      difficultyPoints: normalizeDifficultyPoints(task.difficulty_points),
      assigneeUserId: task.assignee_user_id,
      createdAt: task.created_at,
    })),
    role:
      membership.role === "owner" || membership.role === "admin"
        ? "admin"
        : "user",
  };
}

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

  // Check if user has added project or profile skills (required before viewing dashboard)
  const [
    { data: existingProjectSkill, error: existingProjectSkillError },
    { data: existingProfileSkill, error: existingProfileSkillError },
  ] = await Promise.all([
    supabase
      .from("project_member_skills")
      .select("skill_id")
      .eq("project_id", projectId)
      .eq("user_id", sessionUser.userId)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("user_skills")
      .select("skill_id")
      .eq("user_id", sessionUser.userId)
      .limit(1)
      .maybeSingle(),
  ]);

  if (existingProjectSkillError || existingProfileSkillError) {
    throw new Error(
      `Failed checking skills for dashboard access: ${
        existingProjectSkillError?.message ?? existingProfileSkillError?.message
      }`,
    );
  }

  if (!existingProjectSkill && !existingProfileSkill) {
    redirect(`/projects/${projectId}/skills`);
  }

  const dashboardData = await getProjectDashboardData(
    projectId,
    sessionUser.userId,
  );

  if (!dashboardData) {
    notFound();
  }

  return (
    <ProjectDashboardShell
      members={dashboardData.members}
      project={dashboardData.project}
      projectId={projectId}
      tasks={dashboardData.tasks}
      viewerRole={dashboardData.role}
      viewerUserId={sessionUser.userId}
    />
  );
}
