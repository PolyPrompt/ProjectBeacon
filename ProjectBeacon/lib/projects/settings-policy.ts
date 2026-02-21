import {
  hasMinimumProjectRole,
  normalizeProjectRole,
} from "@/lib/auth/project-role";

export type ProjectSettingsCapabilities = {
  canShare: boolean;
  canLeave: boolean;
  canEditProject: boolean;
  canDeleteProject: boolean;
};

export function getProjectSettingsCapabilities(
  role: string | null | undefined,
): ProjectSettingsCapabilities {
  const normalizedRole = normalizeProjectRole(role);

  if (!normalizedRole) {
    return {
      canShare: false,
      canLeave: false,
      canEditProject: false,
      canDeleteProject: false,
    };
  }

  return {
    canShare: true,
    canLeave: true,
    canEditProject: hasMinimumProjectRole(normalizedRole, "admin"),
    canDeleteProject: hasMinimumProjectRole(normalizedRole, "admin"),
  };
}

export function isLastAdminLeaveBlocked(params: {
  role: string | null | undefined;
  adminCount: number;
}): boolean {
  const normalizedRole = normalizeProjectRole(params.role);
  if (normalizedRole !== "admin") {
    return false;
  }

  return params.adminCount <= 1;
}
