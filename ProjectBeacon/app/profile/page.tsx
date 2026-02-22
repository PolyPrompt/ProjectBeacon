import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { SkillsEditor } from "@/components/profile/skills-editor";

export default async function ProfilePage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/");
  }

  return (
    <main className="min-h-[calc(100vh-73px)] w-full bg-[#140f20]">
      <div className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-7xl flex-col px-6 py-10">
        <section className="mb-8 border-b border-violet-500/20 pb-6">
          <p className="inline-flex rounded-full bg-violet-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-violet-200">
            Step 1: Profile
          </p>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-100 md:text-5xl">
            You&apos;re in! Welcome to{" "}
            <span className="text-violet-400">TaskLogger</span>
          </h1>
          <p className="mt-3 max-w-3xl text-base text-slate-300">
            Build your technical profile so Project Beacon can match you with
            the right tasks and skill-based delegation.
          </p>
        </section>
        <SkillsEditor />
      </div>
    </main>
  );
}
