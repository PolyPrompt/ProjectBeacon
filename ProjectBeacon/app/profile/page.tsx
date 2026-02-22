import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { getServiceSupabaseClient } from "@/lib/supabase/server";

export default async function ProfilePageRedirect() {
  const user = await requireUser();
  const supabase = getServiceSupabaseClient();

  const { data: membership } = await supabase
    .from("project_members")
    .select("project_id")
    .eq("user_id", user.userId)
    .limit(1)
    .maybeSingle();

  if (membership?.project_id) {
    redirect(`/projects/${membership.project_id}/skills`);
  }

  redirect("/projects/new");
}
