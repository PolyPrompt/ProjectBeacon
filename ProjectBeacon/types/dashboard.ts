export type ProjectPlanningStatus = "draft" | "locked" | "assigned";
export type TaskStatus = "todo" | "in_progress" | "blocked" | "done";

export type ProjectSummary = {
  id: string;
  name: string;
  description: string;
  deadline: string;
  planningStatus: ProjectPlanningStatus;
};

export type ProjectMember = {
  userId: string;
  name: string;
  email: string;
  role: "owner" | "member";
};

export type ProjectTask = {
  id: string;
  title: string;
  status: TaskStatus;
  assigneeUserId: string | null;
  difficultyPoints: 1 | 2 | 3 | 5 | 8;
};

export type DependencyEdge = {
  taskId: string;
  dependsOnTaskId: string;
};

export type ProjectDashboardViewModel = {
  project: ProjectSummary;
  members: ProjectMember[];
  tasks: ProjectTask[];
  dependencyEdges: DependencyEdge[];
};

export type PlanningWorkspaceState = {
  contexts: Array<{ id: string; title: string | null; contextType: string; createdAt: string }>;
  documents: Array<{ id: string; fileName: string; createdAt: string }>;
  clarification: {
    confidence: number;
    readyForGeneration: boolean;
    askedCount: number;
    maxQuestions: number;
  };
  canGenerate: boolean;
};
