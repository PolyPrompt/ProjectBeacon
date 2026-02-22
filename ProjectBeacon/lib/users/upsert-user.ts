import { currentUser } from "@clerk/nextjs/server";

import { ApiHttpError } from "@/lib/api/errors";
import { getServiceSupabaseClient } from "@/lib/supabase/server";

export type UserBootstrapResult = {
  userId: string;
  clerkUserId: string;
  email: string;
  created: boolean;
};

function getDisplayName(input: {
  firstName: string | null;
  lastName: string | null;
  email: string;
}) {
  const fullName = [input.firstName, input.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  return fullName.length > 0 ? fullName : input.email;
}

export async function upsertUserFromClerk(
  clerkUserId: string,
): Promise<UserBootstrapResult> {
  const user = await currentUser();

  if (!user || user.id !== clerkUserId) {
    throw new ApiHttpError(401, "UNAUTHORIZED", "Authentication is required");
  }

  const primaryEmail = user.emailAddresses.find(
    (email) => email.id === user.primaryEmailAddressId,
  );
  const email =
    primaryEmail?.emailAddress ?? user.emailAddresses[0]?.emailAddress;

  if (!email) {
    throw new ApiHttpError(
      400,
      "MISSING_EMAIL",
      "Clerk user does not have a usable email address",
    );
  }

  const name = getDisplayName({
    firstName: user.firstName,
    lastName: user.lastName,
    email,
  });

  const supabase = getServiceSupabaseClient();

  const { data: existingRow, error: existingError } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();

  if (existingError) {
    throw new ApiHttpError(
      500,
      "DB_ERROR",
      "Failed reading user bootstrap state",
      existingError.message,
    );
  }

  let resolvedExistingRow = existingRow;

  if (!resolvedExistingRow) {
    // Handle legacy rows created before clerk_user_id existed.
    const { data: emailMatchedRow, error: emailMatchError } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (emailMatchError) {
      throw new ApiHttpError(
        500,
        "DB_ERROR",
        "Failed matching existing user by email",
        emailMatchError.message,
      );
    }

    resolvedExistingRow = emailMatchedRow;
  }

  const created = !resolvedExistingRow;

  const { data: upserted, error: upsertError } = await supabase
    .from("users")
    .upsert(
      {
        ...(resolvedExistingRow ? { id: resolvedExistingRow.id } : {}),
        clerk_user_id: clerkUserId,
        email,
        name,
      },
      {
        onConflict: "clerk_user_id",
      },
    )
    .select("id")
    .single();

  if (upsertError) {
    throw new ApiHttpError(
      500,
      "DB_ERROR",
      "Failed syncing user profile",
      upsertError.message,
    );
  }

  return {
    userId: upserted.id,
    clerkUserId,
    email,
    created,
  };
}
