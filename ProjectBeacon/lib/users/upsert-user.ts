import { currentUser } from "@clerk/nextjs/server";

import { ApiHttpError } from "@/lib/api/errors";
import { getServiceSupabaseClient } from "@/lib/supabase/server";

export type UserBootstrapResult = {
  userId: string;
  clerkUserId: string;
  email: string;
  created: boolean;
};

type ExistingUserRow = {
  id: string;
  clerk_user_id: string | null;
  email: string;
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

  const { data: clerkMatchRow, error: clerkMatchError } = await supabase
    .from("users")
    .select("id,clerk_user_id,email")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();

  if (clerkMatchError) {
    throw new ApiHttpError(
      500,
      "DB_ERROR",
      "Failed reading user bootstrap state",
      clerkMatchError.message,
    );
  }

  let existingRow = clerkMatchRow as ExistingUserRow | null;

  if (!existingRow) {
    const { data: emailMatchRow, error: emailMatchError } = await supabase
      .from("users")
      .select("id,clerk_user_id,email")
      .eq("email", email)
      .maybeSingle();

    if (emailMatchError) {
      throw new ApiHttpError(
        500,
        "DB_ERROR",
        "Failed reading user bootstrap state",
        emailMatchError.message,
      );
    }

    existingRow = emailMatchRow as ExistingUserRow | null;
  }

  const created = !existingRow;

  if (existingRow) {
    const { data: updatedRow, error: updateError } = await supabase
      .from("users")
      .update({
        clerk_user_id: clerkUserId,
        email,
        name,
      })
      .eq("id", existingRow.id)
      .select("id")
      .single();

    if (updateError) {
      throw new ApiHttpError(
        500,
        "DB_ERROR",
        "Failed syncing user profile",
        updateError.message,
      );
    }

    return {
      userId: updatedRow.id,
      clerkUserId,
      email,
      created,
    };
  }

  const { data: insertedRow, error: insertError } = await supabase
    .from("users")
    .insert({
      clerk_user_id: clerkUserId,
      email,
      name,
    })
    .select("id")
    .single();

  if (insertError) {
    throw new ApiHttpError(
      500,
      "DB_ERROR",
      "Failed syncing user profile",
      insertError.message,
    );
  }

  return {
    userId: insertedRow.id,
    clerkUserId,
    email,
    created,
  };
}
