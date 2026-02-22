import { z } from "zod";

export const CLARIFICATION_QUESTION_MIN_LENGTH = 40;
export const CLARIFICATION_QUESTION_MAX_LENGTH = 280;

export const difficultyPointsSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(5),
  z.literal(8),
]);

export const taskStatusSchema = z.enum([
  "todo",
  "in_progress",
  "blocked",
  "done",
]);

export const clarificationStateSchema = z.object({
  confidence: z.number().min(0).max(100),
  threshold: z.number().int().min(1).max(100),
  askedCount: z.number().int().min(0),
  maxQuestions: z.number().int().min(1),
  questions: z
    .array(
      z
        .string()
        .min(CLARIFICATION_QUESTION_MIN_LENGTH)
        .max(CLARIFICATION_QUESTION_MAX_LENGTH),
    )
    .default([]),
  assumptions: z.array(z.string().min(1).max(300)).optional(),
  readyForGeneration: z.boolean(),
});

export type ClarificationState = z.infer<typeof clarificationStateSchema>;

export const aiConfidenceOutputSchema = z.object({
  confidence: z.number().min(0).max(100),
  followUpQuestions: z
    .array(
      z
        .string()
        .min(CLARIFICATION_QUESTION_MIN_LENGTH)
        .max(CLARIFICATION_QUESTION_MAX_LENGTH),
    )
    .max(3)
    .default([]),
  assumptions: z.array(z.string().min(1).max(300)).max(5).default([]),
});

export type AIConfidenceOutput = z.infer<typeof aiConfidenceOutputSchema>;

export const aiClarifyingQuestionsOutputSchema = z.object({
  clarification_questions: z
    .array(
      z
        .string()
        .min(CLARIFICATION_QUESTION_MIN_LENGTH)
        .max(CLARIFICATION_QUESTION_MAX_LENGTH),
    )
    .max(5),
  reasoning: z.string().min(1).max(600),
});

export type AIClarifyingQuestionsOutput = z.infer<
  typeof aiClarifyingQuestionsOutputSchema
>;

export const aiDraftTaskSchema = z.object({
  tempId: z.string().min(1).max(50),
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(1000),
  difficultyPoints: difficultyPointsSchema,
  dueAt: z.string().datetime({ offset: true }).nullable(),
  requiredSkills: z
    .array(
      z.object({
        skillName: z.string().min(1).max(80),
        weight: z.number().min(1).max(5),
      }),
    )
    .max(8),
  dependsOnTempIds: z.array(z.string().min(1).max(50)).max(8).default([]),
});

export const aiTaskPlanOutputSchema = z.object({
  tasks: z.array(aiDraftTaskSchema).min(6).max(12),
});

export type AITaskPlanOutput = z.infer<typeof aiTaskPlanOutputSchema>;

export const generateTasksResponseSchema = z.object({
  tasks: z.array(
    z.object({
      id: z.string().min(1),
      projectId: z.string().min(1),
      assigneeUserId: z.string().min(1).nullable(),
      title: z.string().min(1),
      description: z.string().min(1),
      difficultyPoints: difficultyPointsSchema,
      status: taskStatusSchema,
      dueAt: z.string().datetime({ offset: true }).nullable(),
      createdAt: z.string().datetime({ offset: true }),
      updatedAt: z.string().datetime({ offset: true }),
    }),
  ),
  taskSkills: z.array(
    z.object({
      id: z.string().min(1),
      taskId: z.string().min(1),
      skillId: z.string().min(1),
      weight: z.number().min(1).max(5),
      createdAt: z.string().datetime({ offset: true }),
    }),
  ),
  taskDependencies: z.array(
    z.object({
      id: z.string().min(1),
      taskId: z.string().min(1),
      dependsOnTaskId: z.string().min(1),
    }),
  ),
});

export type AIGenerationResult = z.infer<typeof generateTasksResponseSchema>;
