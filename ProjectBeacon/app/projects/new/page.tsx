import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { ProjectForm } from "@/components/projects/project-form";

export default async function NewProjectPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/");
  }

  return (
    <main className="min-h-[calc(100vh-73px)] bg-slate-50">
      <ProjectForm />
    </main>
  );
}
