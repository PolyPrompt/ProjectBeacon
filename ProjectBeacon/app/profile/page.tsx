import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { SkillsEditor } from "@/components/profile/skills-editor";

export default async function ProfilePage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/");
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <h1 className="text-3xl font-bold">Profile</h1>
      <SkillsEditor />
    </main>
  );
}
