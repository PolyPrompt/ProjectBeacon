import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export type SessionUser = {
  clerkUserId: string;
  email: string | null;
  localUserId: string | null;
};

type RequireSessionUserOptions = {
  redirectToSignIn?: boolean;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  const user = await currentUser();

  return {
    clerkUserId: userId,
    email: user?.emailAddresses[0]?.emailAddress ?? null,
    localUserId: null,
  };
}

export async function requireSessionUser(
  options: RequireSessionUserOptions = {},
): Promise<SessionUser> {
  const sessionUser = await getSessionUser();

  if (sessionUser) {
    return sessionUser;
  }

  if (options.redirectToSignIn) {
    redirect("/sign-in");
  }

  throw new Error("UNAUTHENTICATED");
}
