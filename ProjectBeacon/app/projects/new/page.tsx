import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import {
  getE2EBypassClerkUserId,
  isE2EAuthBypassEnabled,
} from "@/lib/auth/e2e-bypass";
import { ProjectForm } from "@/components/projects/project-form";

export default async function NewProjectPage() {
  const userId = isE2EAuthBypassEnabled()
    ? getE2EBypassClerkUserId()
    : (await auth()).userId;

  if (!userId) {
    redirect("/");
  }

  return (
    <main className="min-h-[calc(100vh-73px)] bg-slate-50">
      <ProjectForm />
    </main>
  );
}
