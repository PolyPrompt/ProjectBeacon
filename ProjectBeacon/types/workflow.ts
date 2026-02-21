import type { TaskStatus } from "@/types/dashboard";

export type WorkflowTaskDTO = {
  id: string;
  title: string;
  status: TaskStatus;
  dueAt: string | null;
  dependencyTaskIds: string[];
  phase: "beginning" | "middle" | "end";
};

export type WorkflowBoardColumnDTO = {
  userId: string;
  userName: string;
  tasks: WorkflowTaskDTO[];
};

export type WorkflowCapabilitiesDTO = {
  canEdit: boolean;
  canReassign?: boolean;
};

export type WorkflowBoardDTO = {
  columns: WorkflowBoardColumnDTO[];
  capabilities: WorkflowCapabilitiesDTO;
};

export type WorkflowTimelineDTO = {
  tasks: WorkflowTaskDTO[];
  capabilities: WorkflowCapabilitiesDTO;
};
