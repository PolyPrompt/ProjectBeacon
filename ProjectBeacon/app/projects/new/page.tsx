import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { ProjectForm } from "@/components/projects/project-form";

export default async function NewProjectPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/");
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <ProjectForm />
    </main>
  );
}
