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
    <>
      <style>{`
        body:has(main[data-page="projects-new"]) > header {
          display: none;
        }
      `}</style>
      <main data-page="projects-new" className="min-h-screen">
        <ProjectForm />
      </main>
    </>
  );
}
