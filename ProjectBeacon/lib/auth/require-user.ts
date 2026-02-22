import { auth } from "@clerk/nextjs/server";

import { ApiHttpError } from "@/lib/api/errors";
import {
  getE2EBypassClerkUserId,
  getE2EBypassUserId,
  isE2EAuthBypassEnabled,
} from "@/lib/auth/e2e-bypass";
import { getServiceSupabaseClient } from "@/lib/supabase/server";
import { upsertUserFromClerk } from "@/lib/users/upsert-user";

export type AuthenticatedUser = {
  userId: string;
  clerkUserId: string;
};

export async function requireUser(): Promise<AuthenticatedUser> {
  if (isE2EAuthBypassEnabled()) {
    return {
      userId: getE2EBypassUserId(),
      clerkUserId: getE2EBypassClerkUserId(),
    };
  }

  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    throw new ApiHttpError(401, "UNAUTHORIZED", "Authentication is required");
  }

  const supabase = getServiceSupabaseClient();

  const { data, error } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();

  if (error) {
    throw new ApiHttpError(
      500,
      "DB_ERROR",
      "Failed to load authenticated user",
      error.message,
    );
  }

  if (!data) {
    const bootstrapped = await upsertUserFromClerk(clerkUserId);

    return {
      userId: bootstrapped.userId,
      clerkUserId,
    };
  }

  return {
    userId: data.id,
    clerkUserId,
  };
}
