import { NextResponse } from "next/server";
import { z } from "zod";

import { handleRouteError, jsonError } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/require-user";
import {
  requireProjectMember,
  requireProjectOwner,
} from "@/lib/projects/membership";
import { getServiceSupabaseClient } from "@/lib/supabase/server";

const paramsSchema = z.object({
  projectId: z.uuid(),
});

const addMemberSchema = z.object({
  userId: z.uuid(),
  role: z.enum(["owner", "member"]),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await requireUser();
    const params = paramsSchema.parse(await context.params);

    await requireProjectMember(params.projectId, user.userId);

    const supabase = getServiceSupabaseClient();

    const { data: members, error: membersError } = await supabase
      .from("project_members")
      .select("user_id,role")
      .eq("project_id", params.projectId);

    if (membersError) {
      return jsonError(
        500,
        "DB_ERROR",
        "Failed loading project members",
        membersError.message,
      );
    }

    const userIds = members.map((member) => member.user_id);

    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id,name,email")
      .in("id", userIds);

    if (usersError) {
      return jsonError(
        500,
        "DB_ERROR",
        "Failed loading member profiles",
        usersError.message,
      );
    }

    const usersById = new Map(users.map((item) => [item.id, item]));

    return NextResponse.json(
      {
        members: members.map((member) => {
          const profile = usersById.get(member.user_id);

          return {
            userId: member.user_id,
            name: profile?.name ?? "Unknown",
            email: profile?.email ?? "",
            role: member.role,
          };
        }),
      },
      { status: 200 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const user = await requireUser();
    const params = paramsSchema.parse(await context.params);

    await requireProjectOwner(params.projectId, user.userId);

    const body = await request.json();
    const payload = addMemberSchema.parse(body);

    const supabase = getServiceSupabaseClient();

    const { data: member, error } = await supabase
      .from("project_members")
      .upsert(
        {
          project_id: params.projectId,
          user_id: payload.userId,
          role: payload.role,
        },
        {
          onConflict: "project_id,user_id",
        },
      )
      .select("project_id,user_id,role")
      .single();

    if (error) {
      return jsonError(
        500,
        "DB_ERROR",
        "Failed adding project member",
        error.message,
      );
    }

    return NextResponse.json(
      {
        projectId: member.project_id,
        userId: member.user_id,
        role: member.role,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
