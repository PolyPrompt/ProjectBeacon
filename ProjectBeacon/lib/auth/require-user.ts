import { auth } from "@clerk/nextjs/server";

import { ApiHttpError } from "@/lib/api/errors";
import { getServiceSupabaseClient } from "@/lib/supabase/server";

export type AuthenticatedUser = {
  userId: string;
  clerkUserId: string;
};

export async function requireUser(): Promise<AuthenticatedUser> {
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
    throw new ApiHttpError(
      401,
      "USER_NOT_BOOTSTRAPPED",
      "User is not yet initialized",
    );
  }

  return {
    userId: data.id,
    clerkUserId,
  };
}
