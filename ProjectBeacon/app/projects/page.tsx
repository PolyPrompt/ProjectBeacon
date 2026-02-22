import { UserButton } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ProjectsIndexPage } from "@/components/projects/projects-index-page";
import { isE2EAuthBypassEnabled } from "@/lib/auth/e2e-bypass";
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

function getUserInitials(userId: string): string {
  const trimmed = userId.trim();

  if (trimmed.length <= 2) {
    return trimmed.toUpperCase();
  }

  return trimmed.slice(0, 2).toUpperCase();
}

export default async function ProjectsPage() {
  const sessionUser = await requireSessionUser("/projects");
  const useClerkUserButton = !isE2EAuthBypassEnabled();
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

  async function signOutAction() {
    "use server";

    redirect("/sign-in");
  }

  const userInitials = getUserInitials(sessionUser.userId);

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
        <header className="sticky top-0 z-30 border-b border-white/10 bg-[linear-gradient(90deg,#16112B_0%,#17142F_45%,#12172E_100%)]">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-3 sm:px-6">
            <Link
              className="flex items-center gap-2 text-slate-100 transition-opacity hover:opacity-90"
              href="/projects"
            >
              <Image
                alt="TaskLogger beaver logo"
                height={24}
                priority
                src="/beaver.png"
                width={24}
              />
              <span className="text-xl font-semibold leading-none sm:text-3xl">
                TaskLogger
              </span>
            </Link>

            <div className="flex items-center gap-3">
              <span className="hidden rounded-full border border-violet-300/40 bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-violet-100 sm:inline-block">
                {sessionUser.role}
              </span>
              {useClerkUserButton ? (
                <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-full border border-violet-300/50 bg-white/5">
                  <UserButton
                    afterSignOutUrl="/sign-in"
                    appearance={{
                      elements: {
                        avatarBox: "h-10 w-10",
                        userButtonTrigger:
                          "h-10 w-10 rounded-full border-0 bg-transparent shadow-none hover:bg-white/10",
                      },
                    }}
                  />
                </div>
              ) : (
                <form action={signOutAction}>
                  <button
                    aria-label="Sign out"
                    className="grid h-10 w-10 place-items-center rounded-full border border-violet-300/50 bg-white/5 text-xs font-semibold text-slate-100 transition-colors hover:bg-white/10"
                    title="Sign out"
                    type="submit"
                  >
                    {userInitials}
                  </button>
                </form>
              )}
            </div>
          </div>
        </header>
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
