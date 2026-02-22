export type TaskStatus = "todo" | "in_progress" | "blocked" | "done";

export type MyTaskDTO = {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  softDeadline: string | null;
  difficultyPoints: 1 | 2 | 3 | 5 | 8;
};

export type DashboardTeamStatus = {
  todo: number;
  inProgress: number;
  blocked: number;
  done: number;
};

export type DashboardSummaryDTO = {
  myTasks: MyTaskDTO[];
  finalDeadlineCountdownHours: number;
  nextMilestoneCountdownHours: number | null;
  teamStatus: DashboardTeamStatus;
};

export type TaskDetailModalDTO = {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  softDeadline: string | null;
  assignmentReasoning: string;
  dependencyTaskIds: string[];
  timelineTaskUrl: string;
  timelinePlacement: {
    phase: "beginning" | "middle" | "end";
    sequenceIndex: number;
    totalTasks: number;
  };
};
