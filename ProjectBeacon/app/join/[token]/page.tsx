import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/require-user";
import { joinProjectWithToken } from "@/lib/projects/share-token";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/");
  }

  try {
    const localUser = await requireUser();
    const { token } = await params;
    const result = await joinProjectWithToken({
      token,
      userId: localUser.userId,
    });

    redirect(`/projects/${result.projectId}`);
  } catch {
    return (
      <main className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col items-start justify-center gap-4 px-6">
        <h1 className="text-2xl font-bold">Unable to join project</h1>
        <p className="text-black/70">
          This link is invalid, expired, or your account is not ready yet.
        </p>
        <Link
          className="rounded bg-black px-4 py-2 text-white"
          href="/projects/new"
        >
          Go to projects
        </Link>
      </main>
    );
  }
}
