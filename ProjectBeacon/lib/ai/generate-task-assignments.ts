import { z } from "zod";
import type {
  AssignmentResult,
  MemberEffectiveSkills,
  TaskForAssignment,
  TaskSkillRequirement,
} from "@/lib/assignment/assign-tasks";
import { resolveOpenAIModelForOperation } from "@/lib/ai/model-selection";
import { getOpenAIChatRequestTuning } from "@/lib/ai/openai-chat-options";
import { getTaskAssignmentSystemPrompt } from "@/lib/ai/prompt-registry";
import { getServerEnv } from "@/lib/server/env";

const assignmentOutputSchema = z.object({
  assignments: z.array(
    z.object({
      taskId: z.string().min(1),
      assigneeUserId: z.string().min(1),
    }),
  ),
});

type AssignmentOutput = z.infer<typeof assignmentOutputSchema>;

type GenerateTaskAssignmentsInput = {
  projectId: string;
  projectName: string;
  projectDescription: string;
  tasks: TaskForAssignment[];
  members: MemberEffectiveSkills[];
  taskRequirements: TaskSkillRequirement[];
};

export type GenerateTaskAssignmentsResult = {
  assignments: AssignmentResult["assignments"] | null;
  model: string | null;
  latencyMs: number | null;
};

function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function toSkillEntries(skills: Record<string, number>) {
  return Object.entries(skills).map(([skillId, level]) => ({
    skillId,
    level,
  }));
}

function validateAssignments(
  assignments: AssignmentOutput["assignments"],
  input: GenerateTaskAssignmentsInput,
): AssignmentResult["assignments"] | null {
  const eligibleTaskIds = new Set(
    input.tasks
      .filter((task) => task.status === "todo" && task.assigneeUserId === null)
      .map((task) => task.id),
  );
  const memberIds = new Set(input.members.map((member) => member.userId));
  const seenTaskIds = new Set<string>();

  for (const assignment of assignments) {
    if (!eligibleTaskIds.has(assignment.taskId)) {
      return null;
    }

    if (!memberIds.has(assignment.assigneeUserId)) {
      return null;
    }

    if (seenTaskIds.has(assignment.taskId)) {
      return null;
    }

    seenTaskIds.add(assignment.taskId);
  }

  return assignments;
}

export async function generateTaskAssignments(
  input: GenerateTaskAssignmentsInput,
): Promise<GenerateTaskAssignmentsResult> {
  try {
    const env = getServerEnv();
    if (!env.OPENAI_API_KEY) {
      return {
        assignments: null,
        model: null,
        latencyMs: null,
      };
    }

    const model = resolveOpenAIModelForOperation(env, "task_assignment");
    const systemPrompt = getTaskAssignmentSystemPrompt();
    const requestStartedAt = nowMs();

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        ...getOpenAIChatRequestTuning(model),
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: JSON.stringify({
              projectId: input.projectId,
              projectName: input.projectName,
              projectDescription: input.projectDescription,
              tasks: input.tasks,
              members: input.members.map((member) => ({
                userId: member.userId,
                currentLoad: member.currentLoad,
                skills: toSkillEntries(member.skills),
              })),
              taskRequirements: input.taskRequirements,
            }),
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "task_assignment_plan",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                assignments: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      taskId: { type: "string", minLength: 1 },
                      assigneeUserId: { type: "string", minLength: 1 },
                    },
                    required: ["taskId", "assigneeUserId"],
                  },
                },
              },
              required: ["assignments"],
            },
          },
        },
      }),
    });

    if (!response.ok) {
      return {
        assignments: null,
        model,
        latencyMs: Math.max(1, Math.round(nowMs() - requestStartedAt)),
      };
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      return {
        assignments: null,
        model,
        latencyMs: Math.max(1, Math.round(nowMs() - requestStartedAt)),
      };
    }

    let candidate: unknown;
    try {
      candidate = JSON.parse(content);
    } catch {
      return {
        assignments: null,
        model,
        latencyMs: Math.max(1, Math.round(nowMs() - requestStartedAt)),
      };
    }

    const parsed = assignmentOutputSchema.safeParse(candidate);
    if (!parsed.success) {
      return {
        assignments: null,
        model,
        latencyMs: Math.max(1, Math.round(nowMs() - requestStartedAt)),
      };
    }

    return {
      assignments: validateAssignments(parsed.data.assignments, input),
      model,
      latencyMs: Math.max(1, Math.round(nowMs() - requestStartedAt)),
    };
  } catch {
    return {
      assignments: null,
      model: null,
      latencyMs: null,
    };
  }
}
