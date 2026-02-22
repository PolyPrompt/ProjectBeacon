import { notFound, redirect } from "next/navigation";
import { ProjectCompletePage } from "@/components/projects/project-complete-page";
import { requireSessionUser } from "@/lib/auth/session";
import { isProjectComplete } from "@/lib/projects/completion";
import { getServiceSupabaseClient } from "@/lib/supabase/server";

type ProjectCompleteRouteProps = {
  params: Promise<{ projectId: string }>;
};

type ProjectRow = {
  id: string;
  name: string;
  created_at: string | null;
};

type TaskRow = {
  status: string;
  updated_at: string | null;
  created_at: string | null;
};

function parseIsoTime(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value).getTime();
  if (Number.isNaN(parsed)) {
    return null;
  }

  return parsed;
}

function formatCompletedAtLabel(timestampMs: number): string {
  return new Date(timestampMs).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function ProjectCompleteRoute({
  params,
}: ProjectCompleteRouteProps) {
  const { projectId } = await params;
  const sessionUser = await requireSessionUser(
    `/projects/${projectId}/complete`,
    {
      projectId,
    },
  );
  const supabase = getServiceSupabaseClient();

  const { data: membership, error: membershipError } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", sessionUser.userId)
    .maybeSingle();

  if (membershipError) {
    throw new Error(
      `Failed loading project membership for completion view: ${membershipError.message}`,
    );
  }

  if (!membership) {
    notFound();
  }

  const [projectResult, tasksResult] = await Promise.all([
    supabase
      .from("projects")
      .select("id,name,created_at")
      .eq("id", projectId)
      .maybeSingle<ProjectRow>(),
    supabase
      .from("tasks")
      .select("status,updated_at,created_at")
      .eq("project_id", projectId)
      .returns<TaskRow[]>(),
  ]);

  if (projectResult.error) {
    throw new Error(
      `Failed loading completion project details: ${projectResult.error.message}`,
    );
  }
  if (!projectResult.data) {
    notFound();
  }

  if (tasksResult.error) {
    throw new Error(
      `Failed loading completion tasks: ${tasksResult.error.message}`,
    );
  }

  const tasks = tasksResult.data ?? [];
  if (!isProjectComplete(tasks.map((task) => task.status ?? ""))) {
    redirect(`/projects/${projectId}`);
  }

  const projectCreatedAtMs = parseIsoTime(projectResult.data.created_at) ?? 0;
  const completedAtMs = Math.max(
    ...tasks
      .map(
        (task) =>
          parseIsoTime(task.updated_at) ?? parseIsoTime(task.created_at),
      )
      .filter((value): value is number => value !== null),
    projectCreatedAtMs,
  );
  const createdAtMs = projectCreatedAtMs || completedAtMs;
  const projectDurationDays = Math.max(
    1,
    Math.ceil((completedAtMs - createdAtMs) / (24 * 60 * 60 * 1000)),
  );

  return (
    <ProjectCompletePage
      projectId={projectId}
      projectName={projectResult.data.name}
      completedTaskCount={tasks.length}
      projectDurationDays={projectDurationDays}
      completedAtLabel={formatCompletedAtLabel(completedAtMs)}
    />
  );
}
