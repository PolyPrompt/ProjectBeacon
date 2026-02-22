import { redirect } from "next/navigation";

type ProjectBoardRouteProps = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ view?: string }>;
};

export default async function ProjectBoardRoute({
  params,
  searchParams,
}: ProjectBoardRouteProps) {
  const { projectId } = await params;
  const { view } = await searchParams;
  const query = view ? `?view=${encodeURIComponent(view)}` : "";
  redirect(`/projects/${projectId}/userflow/board${query}`);
}
