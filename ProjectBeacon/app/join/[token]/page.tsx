import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { JoinProjectClient } from "@/components/projects/join-project-client";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { userId } = await auth();
  const { token } = await params;

  if (!userId) {
    redirect(`/sign-in?next=${encodeURIComponent(`/join/${token}`)}`);
  }

  return <JoinProjectClient token={token} />;
}
