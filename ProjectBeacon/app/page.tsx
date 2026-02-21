import { redirect } from "next/navigation";
import { getLastProjectId, getSessionUser } from "@/lib/auth/session";

export default async function Home() {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    redirect("/sign-in");
  }

  const lastProjectId = await getLastProjectId();
  redirect(`/projects/${lastProjectId ?? "demo-project"}`);
}
