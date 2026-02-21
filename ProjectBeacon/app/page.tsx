import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getServiceSupabaseClient } from "@/lib/supabase/server";

export default async function Home() {
  const { userId } = await auth();

  if (userId) {
    const supabase = getServiceSupabaseClient();

    const { data: localUser } = await supabase
      .from("users")
      .select("id")
      .eq("clerk_user_id", userId)
      .maybeSingle();

    if (localUser?.id) {
      const { data: recentMembership } = await supabase
        .from("project_members")
        .select("project_id")
        .eq("user_id", localUser.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recentMembership?.project_id) {
        redirect(`/projects/${recentMembership.project_id}`);
      }
    }

    redirect("/projects/new");
  }

  return (
    <main className="mx-auto flex min-h-[80vh] w-full max-w-5xl flex-col items-start justify-center gap-4 px-6">
      <h1 className="text-4xl font-bold">Project Beacon</h1>
      <p className="max-w-xl text-black/70">
        Sign in to create a project, manage team skills, and upload project
        documents.
      </p>
    </main>
  );
}
