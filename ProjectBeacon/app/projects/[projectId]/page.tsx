import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { ProjectDocumentsUploader } from "@/components/projects/project-documents-uploader";
import { ProjectSkillsEditor } from "@/components/projects/project-skills-editor";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/");
  }

  const { projectId } = await params;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-10">
      <h1 className="text-3xl font-bold">Project Workspace</h1>
      <ProjectSkillsEditor projectId={projectId} />
      <ProjectDocumentsUploader projectId={projectId} />
    </main>
  );
}
