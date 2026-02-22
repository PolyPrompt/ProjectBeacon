import type { ServerEnv } from "@/lib/server/env";

export type AIOperation = "task_plan" | "confidence" | "task_assignment";

const DEFAULT_MODEL = "gpt-4o-mini";

export function resolveOpenAIModelForOperation(
  env: ServerEnv,
  operation: AIOperation,
): string {
  if (operation === "task_plan" && env.OPENAI_MODEL_TASK_PLAN) {
    return env.OPENAI_MODEL_TASK_PLAN;
  }

  if (operation === "confidence" && env.OPENAI_MODEL_CONFIDENCE) {
    return env.OPENAI_MODEL_CONFIDENCE;
  }

  if (operation === "task_assignment" && env.OPENAI_MODEL_TASK_ASSIGNMENT) {
    return env.OPENAI_MODEL_TASK_ASSIGNMENT;
  }

  if (env.OPENAI_MODEL && env.OPENAI_MODEL.trim().length > 0) {
    return env.OPENAI_MODEL;
  }

  return DEFAULT_MODEL;
}
