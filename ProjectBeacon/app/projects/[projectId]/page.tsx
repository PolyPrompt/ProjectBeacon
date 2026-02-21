import { notFound } from "next/navigation";

import { DependencyPreview } from "@/components/dashboard/dependency-preview";
import { ProjectMembersList } from "@/components/dashboard/project-members-list";
import { ProjectSummaryCard } from "@/components/dashboard/project-summary-card";
import { ProjectTaskList } from "@/components/dashboard/project-task-list";
import PlanningWorkspace from "@/components/projects/planning-workspace";
import { requireSessionUser } from "@/lib/auth/session";
import { getServiceSupabaseClient } from "@/lib/supabase/server";

type ProjectDashboardPageProps = {
  params: Promise<{ projectId: string }>;
};

type ProjectDashboardViewModel = {
  project: {
    id: string;
    name: string;
    description: string;
    deadline: string;
    planningStatus: "draft" | "locked" | "assigned";
  };
  members: Array<{
    userId: string;
    name: string;
    email: string;
    role: "owner" | "member";
  }>;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    assigneeUserId: string | null;
    difficultyPoints: 1 | 2 | 3 | 5 | 8;
  }>;
  dependencyEdges: Array<{ taskId: string; dependsOnTaskId: string }>;
};

function normalizePlanningStatus(
  value: string,
): "draft" | "locked" | "assigned" {
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

function normalizeMemberRole(value: string): "owner" | "member" {
  if (value === "owner" || value === "admin") {
    return "owner";
  }
  return "member";
}

async function getProjectDashboardViewModel(
  projectId: string,
  userId: string,
): Promise<ProjectDashboardViewModel | null> {
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

  const [
    projectResponse,
    membersResponse,
    tasksResponse,
    dependenciesResponse,
  ] = await Promise.all([
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
      .select("id,title,status,assignee_user_id,difficulty_points")
      .eq("project_id", projectId),
    supabase
      .from("task_dependencies")
      .select("task_id,depends_on_task_id")
      .eq("project_id", projectId),
  ]);

  if (projectResponse.error || !projectResponse.data) {
    return null;
  }

  if (
    membersResponse.error ||
    tasksResponse.error ||
    dependenciesResponse.error
  ) {
    return null;
  }

  const memberRows = membersResponse.data ?? [];
  const memberUserIds = memberRows.map((member) => member.user_id);

  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("id,name,email")
    .in(
      "id",
      memberUserIds.length > 0
        ? memberUserIds
        : ["00000000-0000-0000-0000-000000000000"],
    );

  if (usersError) {
    return null;
  }

  const usersById = new Map((users ?? []).map((item) => [item.id, item]));

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
    members: memberRows.map((member) => {
      const profile = usersById.get(member.user_id);

      return {
        userId: member.user_id,
        name: profile?.name ?? profile?.email ?? "Unknown member",
        email: profile?.email ?? "",
        role: normalizeMemberRole(member.role),
      };
    }),
    tasks: (tasksResponse.data ?? []).map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      assigneeUserId: task.assignee_user_id,
      difficultyPoints: normalizeDifficultyPoints(task.difficulty_points),
    })),
    dependencyEdges: (dependenciesResponse.data ?? []).map((edge) => ({
      taskId: edge.task_id,
      dependsOnTaskId: edge.depends_on_task_id,
    })),
  };
}

export default async function ProjectDashboardPage({
  params,
}: ProjectDashboardPageProps) {
  const { projectId } = await params;
  const sessionUser = await requireSessionUser(`/projects/${projectId}`);

  const dashboardViewModel = await getProjectDashboardViewModel(
    projectId,
    sessionUser.userId,
  );

  if (!dashboardViewModel) {
    notFound();
  }

  return (
    <section className="space-y-5">
      <ProjectSummaryCard
        project={dashboardViewModel.project}
        projectId={dashboardViewModel.project.id}
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <ProjectMembersList members={dashboardViewModel.members} />
        <ProjectTaskList
          members={dashboardViewModel.members}
          tasks={dashboardViewModel.tasks}
        />
      </div>
      <DependencyPreview
        dependencyEdges={dashboardViewModel.dependencyEdges}
        tasks={dashboardViewModel.tasks}
      />
      <PlanningWorkspace
        projectId={projectId}
        userIdHeaderValue={sessionUser.userId}
      />
    </section>
  );
}
