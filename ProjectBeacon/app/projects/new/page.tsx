import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { ProjectForm } from "@/components/projects/project-form";

export default async function NewProjectPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/");
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <h1 className="text-3xl font-bold">New Project</h1>
      <ProjectForm />
    </main>
  );
}
