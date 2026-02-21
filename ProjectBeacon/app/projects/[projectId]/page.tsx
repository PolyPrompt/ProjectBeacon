import { ProjectDashboardShell } from "@/components/dashboard/project-dashboard-shell";
import {
  PlanningWorkspaceState,
  ProjectDashboardViewModel,
} from "@/types/dashboard";

export const dynamic = "force-dynamic";

type ProjectApiResponse = {
  id: string;
  name: string;
  description: string;
  deadline: string;
  ownerUserId: string;
  planningStatus: "draft" | "locked" | "assigned";
};

type MembersApiResponse = {
  members: Array<{
    userId: string;
    name: string;
    email: string;
    role: "owner" | "member";
  }>;
};

type ConfidenceApiResponse = {
  confidence: number;
  threshold: number;
  askedCount: number;
  maxQuestions: number;
  readyForGeneration: boolean;
};

type PageProps = {
  params: Promise<{
    projectId: string;
  }>;
};

async function fetchContract<T>(
  path: string,
  init?: RequestInit,
): Promise<T | null> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function getFallbackViewModel(projectId: string): ProjectDashboardViewModel {
  return {
    project: {
      id: projectId,
      name: "Project Dashboard",
      description:
        "Backend endpoints are not fully available yet. This dashboard is running in scaffold mode with local fallback data.",
      deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
      planningStatus: "draft",
    },
    members: [],
    tasks: [],
    dependencyEdges: [],
  };
}

export default async function ProjectDashboardPage({ params }: PageProps) {
  const { projectId } = await params;

  const fallback = getFallbackViewModel(projectId);

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

  const projectView = projectPayload
    ? {
        id: projectPayload.id,
        name: projectPayload.name,
        description: projectPayload.description,
        deadline: projectPayload.deadline,
        planningStatus: projectPayload.planningStatus,
      }
    : fallback.project;

  const members = membersPayload?.members ?? fallback.members;

  const initialClarification = confidencePayload
    ? {
        confidence: confidencePayload.confidence,
        readyForGeneration: confidencePayload.readyForGeneration,
        askedCount: confidencePayload.askedCount,
        maxQuestions: confidencePayload.maxQuestions,
      }
    : {
        confidence: 0,
        readyForGeneration: false,
        askedCount: 0,
        maxQuestions: 5,
      };

  const initialWorkspaceState: PlanningWorkspaceState = {
    contexts: projectView.description
      ? [
          {
            id: `ctx-initial-${projectView.id}`,
            title: "Project requirements",
            contextType: "initial",
            createdAt: new Date().toISOString(),
          },
        ]
      : [],
    documents: [],
    clarification: initialClarification,
    canGenerate: initialClarification.readyForGeneration,
  };

  const initialViewModel: ProjectDashboardViewModel = {
    project: projectView,
    members,
    tasks: fallback.tasks,
    dependencyEdges: fallback.dependencyEdges,
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-white px-4 py-10 md:px-10">
      <div className="mx-auto max-w-7xl">
        <ProjectDashboardShell
          initialProjectDescription={projectView.description}
          initialViewModel={initialViewModel}
          initialWorkspaceState={initialWorkspaceState}
        />
      </div>
    </main>
  );
}
