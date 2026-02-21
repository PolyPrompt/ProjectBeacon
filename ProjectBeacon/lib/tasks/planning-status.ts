import type { ProjectPlanningStatus } from "@/types/planning";

const ALLOWED_TRANSITIONS: Record<
  ProjectPlanningStatus,
  ProjectPlanningStatus[]
> = {
  draft: ["locked"],
  locked: ["assigned"],
  assigned: [],
};

export function canTransitionPlanningStatus(
  from: ProjectPlanningStatus,
  to: ProjectPlanningStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}
