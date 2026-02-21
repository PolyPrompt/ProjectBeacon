import type {
  TaskDependencyRow,
  TaskRequiredSkillRow,
  TaskRow,
} from "@/types/planning";

export function mapTaskRowToDto(row: TaskRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    assigneeUserId: row.assignee_user_id,
    title: row.title,
    description: row.description,
    difficultyPoints: row.difficulty_points,
    status: row.status,
    dueAt: row.due_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapTaskSkillRowToDto(row: TaskRequiredSkillRow) {
  return {
    id: row.id,
    taskId: row.task_id,
    skillId: row.skill_id,
    weight: row.weight,
    createdAt: row.created_at,
  };
}

export function mapTaskDependencyRowToDto(row: TaskDependencyRow) {
  return {
    id: row.id,
    taskId: row.task_id,
    dependsOnTaskId: row.depends_on_task_id,
  };
}
