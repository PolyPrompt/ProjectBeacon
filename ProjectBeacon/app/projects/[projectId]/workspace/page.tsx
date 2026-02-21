import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{
    projectId: string;
  }>;
};

export default async function WorkspaceIndexPage({ params }: PageProps) {
  const { projectId } = await params;
  redirect(`/projects/${projectId}/workspace/context`);
}
