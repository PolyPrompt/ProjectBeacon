import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { handleRouteError, jsonError } from "@/lib/api/errors";
import { upsertUserFromClerk } from "@/lib/users/upsert-user";

export async function POST() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return jsonError(401, "UNAUTHORIZED", "Authentication is required");
    }

    const result = await upsertUserFromClerk(userId);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}
