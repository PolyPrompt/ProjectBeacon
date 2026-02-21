import {
  isProjectAuthorizationError,
  projectForbiddenResponse,
  requireProjectMembership,
} from "@/lib/auth/project-role";
import { requireSessionUser } from "@/lib/auth/clerk-auth";
import { apiError } from "@/lib/api/errors";
import {
  countProjectAdmins,
  getProjectMembership,
  resolveActorUserId,
} from "@/lib/projects/membership";
import { isLastAdminLeaveBlocked } from "@/lib/projects/settings-policy";
import { getServiceSupabaseClient } from "@/lib/supabase/server";

export async function POST(
  _: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const sessionUser = await requireSessionUser();
    const { projectId } = await params;
    const supabase = getServiceSupabaseClient();

    const actorUserId = await resolveActorUserId(supabase, sessionUser);
    if (!actorUserId) {
      return apiError(
        "PROJECT_FORBIDDEN",
        "You are not a member of this project.",
        403,
      );
    }

    const membership = await getProjectMembership(
      supabase,
      projectId,
      actorUserId,
    );
    const normalizedRole = requireProjectMembership(membership?.role);

    if (
      isLastAdminLeaveBlocked({
        role: normalizedRole,
        adminCount: await countProjectAdmins(supabase, projectId),
      })
    ) {
      return apiError(
        "LAST_ADMIN_LEAVE_FORBIDDEN",
        "The last project admin cannot leave before assigning another admin.",
        409,
      );
    }

    const { error } = await supabase
      .from("project_members")
      .delete()
      .eq("project_id", projectId)
      .eq("user_id", actorUserId);

    if (error) {
      throw error;
    }

    return Response.json({
      left: true,
      projectId,
      userId: actorUserId,
    });
  } catch (error) {
    if (isProjectAuthorizationError(error)) {
      return projectForbiddenResponse(error);
    }

    return apiError("INTERNAL_SERVER_ERROR", "Failed to leave project.", 500);
  }
}
