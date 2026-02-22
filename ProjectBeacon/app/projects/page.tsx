import { redirect } from "next/navigation";

import { ProjectsIndexPage } from "@/components/projects/projects-index-page";
import { requireSessionUser } from "@/lib/auth/session";
import { getServiceSupabaseClient } from "@/lib/supabase/server";

type ProjectRow = {
  id: string;
  name: string;
  description: string;
  deadline: string;
  planning_status: "draft" | "locked" | "assigned";
  created_at: string;
};

export default async function ProjectsPage() {
  const sessionUser = await requireSessionUser("/projects");
  const supabase = getServiceSupabaseClient();

  const { data: memberships, error: membershipsError } = await supabase
    .from("project_members")
    .select("project_id")
    .eq("user_id", sessionUser.userId);

  if (membershipsError) {
    redirect("/projects/new");
  }

  const projectIds = (memberships ?? []).map(
    (membership) => membership.project_id,
  );
  let projects: ProjectRow[] = [];

  if (projectIds.length > 0) {
    const { data: projectRows, error: projectsError } = await supabase
      .from("projects")
      .select("id,name,description,deadline,planning_status,created_at")
      .in("id", projectIds)
      .order("created_at", { ascending: false })
      .returns<ProjectRow[]>();

    if (projectsError) {
      redirect("/projects/new");
    }

    projects = projectRows ?? [];
  }

  return (
    <>
      <style>{`
        body:has(main[data-page="projects-index"]) > header {
          display: none;
        }
      `}</style>
      <main
        data-page="projects-index"
        className="min-h-screen bg-[radial-gradient(120%_90%_at_50%_0%,#1b1434_0%,#0f0a1d_55%,#0b0718_100%)]"
      >
        <ProjectsIndexPage
          projects={projects.map((project) => ({
            id: project.id,
            name: project.name,
            description: project.description,
            deadline: project.deadline,
            planningStatus: project.planning_status,
          }))}
        />
      </main>
    </>
  );
}
