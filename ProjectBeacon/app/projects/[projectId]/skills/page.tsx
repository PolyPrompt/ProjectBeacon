import { SkillsEditor } from "@/components/profile/skills-editor";
import { requireSessionUser } from "@/lib/auth/session";

type ProjectSkillsPageProps = {
  params: Promise<{ projectId: string }>;
};

export default async function ProjectSkillsPage({
  params,
}: ProjectSkillsPageProps) {
  const { projectId } = await params;

  await requireSessionUser(`/projects/${projectId}/skills`, {
    projectId,
  });

  return (
    <section className="space-y-6">
      <section className="border-b border-violet-500/20 pb-5">
        <p className="inline-flex rounded-full bg-violet-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-violet-200">
          Project Skills
        </p>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-100 md:text-4xl">
          Build your project-specific skill profile
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          These skills are saved for your account in this project only.
        </p>
      </section>

      <SkillsEditor
        apiBasePath={`/api/projects/${projectId}/skills`}
        continueHref={`/projects/${projectId}/documents`}
      />
    </section>
  );
}
