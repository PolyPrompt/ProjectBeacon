import type { TaskStatus } from "@/types/dashboard";
import type { ProjectRole } from "@/types/roles";

export type TimelinePhase = "beginning" | "middle" | "end";
export type DueDatePlacement = "early" | "mid" | "late" | "unscheduled";

export type WorkflowCapabilityDTO = {
  role: ProjectRole;
  canManageProject: boolean;
  canEditWorkflow: boolean;
};

export type WorkflowBoardTaskDTO = {
  id: string;
  title: string;
  status: TaskStatus;
  softDeadline: string | null;
  difficultyPoints: 1 | 2 | 3 | 5 | 8;
  phase: TimelinePhase;
};

export type WorkflowBoardColumnDTO = {
  userId: string;
  name: string;
  email: string;
  role: ProjectRole;
  tasks: WorkflowBoardTaskDTO[];
};

export type WorkflowBoardDTO = {
  capability: WorkflowCapabilityDTO;
  columns: WorkflowBoardColumnDTO[];
  unassigned: WorkflowBoardTaskDTO[];
};

export type WorkflowTimelineTaskDTO = {
  id: string;
  title: string;
  status: TaskStatus;
  softDeadline: string | null;
  difficultyPoints: 1 | 2 | 3 | 5 | 8;
  assigneeUserId: string | null;
  sequenceIndex: number;
  totalTasks: number;
  phase: TimelinePhase;
  dueDatePlacement: DueDatePlacement;
};

export type WorkflowTimelineEdgeDTO = {
  taskId: string;
  dependsOnTaskId: string;
};

export type WorkflowTimelineDTO = {
  capability: WorkflowCapabilityDTO;
  tasks: WorkflowTimelineTaskDTO[];
  edges: WorkflowTimelineEdgeDTO[];
};
