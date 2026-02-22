import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getServiceSupabaseClient } from "@/lib/supabase/server";

export default async function Home() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

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
