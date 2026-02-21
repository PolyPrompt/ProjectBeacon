import {
  ConfidenceApiResponse,
  MembersApiResponse,
  ProjectApiResponse,
  fetchContract,
} from "@/lib/workspace/fetch-contract";
import {
  PlanningWorkspaceState,
  ProjectDashboardViewModel,
} from "@/types/dashboard";

export type WorkspacePageData = {
  initialClarification: PlanningWorkspaceState["clarification"];
  initialDescription: string;
  initialPlanningStatus: ProjectDashboardViewModel["project"]["planningStatus"];
  members: ProjectDashboardViewModel["members"];
  project: ProjectDashboardViewModel["project"];
};

function fallbackViewModel(projectId: string): WorkspacePageData {
  const now = new Date();
  const twoWeeksFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  return {
    project: {
      id: projectId,
      name: "Project Workspace",
      description:
        "Backend APIs are still stabilizing. This view is running in scaffold mode.",
      deadline: twoWeeksFromNow.toISOString(),
      planningStatus: "draft",
    },
    members: [],
    initialDescription: "",
    initialPlanningStatus: "draft",
    initialClarification: {
      confidence: 0,
      readyForGeneration: false,
      askedCount: 0,
      maxQuestions: 5,
    },
  };
}

export async function getWorkspacePageData(
  projectId: string,
): Promise<WorkspacePageData> {
  const fallback = fallbackViewModel(projectId);

  const [projectPayload, membersPayload, confidencePayload] = await Promise.all(
    [
      fetchContract<ProjectApiResponse>(`/api/projects/${projectId}`),
      fetchContract<MembersApiResponse>(`/api/projects/${projectId}/members`),
      fetchContract<ConfidenceApiResponse>(
        `/api/projects/${projectId}/context/confidence`,
        {
          method: "POST",
        },
      ),
    ],
  );

  if (!projectPayload) {
    return fallback;
  }

  return {
    project: {
      id: projectPayload.id,
      name: projectPayload.name,
      description: projectPayload.description,
      deadline: projectPayload.deadline,
      planningStatus: projectPayload.planningStatus,
    },
    members: membersPayload?.members ?? [],
    initialDescription: projectPayload.description,
    initialPlanningStatus: projectPayload.planningStatus,
    initialClarification: confidencePayload
      ? {
          confidence: confidencePayload.confidence,
          readyForGeneration: confidencePayload.readyForGeneration,
          askedCount: confidencePayload.askedCount,
          maxQuestions: confidencePayload.maxQuestions,
        }
      : fallback.initialClarification,
  };
}
