export type ProjectPlanningStatus = "draft" | "locked" | "assigned";
export type TaskStatus = "todo" | "in_progress" | "blocked" | "done";

export type TaskRow = {
  id: string;
  project_id: string;
  assignee_user_id: string | null;
  title: string;
  description: string;
  difficulty_points: 1 | 2 | 3 | 5 | 8;
  status: TaskStatus;
  due_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskRequiredSkillRow = {
  id: string;
  task_id: string;
  skill_id: string;
  weight: number;
  created_at: string;
};

export type TaskDependencyRow = {
  id: string;
  task_id: string;
  depends_on_task_id: string;
};

export type SkillRow = {
  id: string;
  name: string;
};
