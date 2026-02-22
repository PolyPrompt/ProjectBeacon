import {
  aiTaskPlanOutputSchema,
  type AITaskPlanOutput,
} from "@/types/ai-output";
import { getServerEnv } from "@/lib/server/env";

export type GenerateTaskPlanInput = {
  projectName: string;
  projectDescription: string;
  projectDeadline: string;
  contextBlocks: Array<{ contextType: string; textContent: string }>;
  availableSkills: string[];
};

type OpenAIFailureReason =
  | "missing_api_key"
  | "provider_request_failed"
  | "provider_http_error"
  | "invalid_provider_payload"
  | "missing_provider_content"
  | "schema_validation_failed";

export type TaskPlanGenerationMode = "openai" | "fallback";

export type TaskPlanGenerationMetadata = {
  mode: TaskPlanGenerationMode;
  model: string;
  strictMode: boolean;
  fallbackReason: OpenAIFailureReason | null;
};

export type GenerateTaskPlanResult = {
  plan: AITaskPlanOutput;
  generation: TaskPlanGenerationMetadata;
};

type OpenAIPlanResult =
  | {
      ok: true;
      plan: AITaskPlanOutput;
      model: string;
    }
  | {
      ok: false;
      reason: OpenAIFailureReason;
      model: string;
      status?: number;
    };

export class AIGenerationUnavailableError extends Error {
  code: "AI_PROVIDER_UNAVAILABLE";
  details: {
    reason: OpenAIFailureReason;
    model: string;
    status?: number;
  };

  constructor(
    message: string,
    details: AIGenerationUnavailableError["details"],
  ) {
    super(message);
    this.name = "AIGenerationUnavailableError";
    this.code = "AI_PROVIDER_UNAVAILABLE";
    this.details = details;
  }
}

const DEFAULT_PLAN_TEMPLATES: Array<{
  title: string;
  description: string;
  difficultyPoints: 1 | 2 | 3 | 5 | 8;
  skillHint: string;
}> = [
  {
    title: "Finalize requirements and acceptance criteria",
    description:
      "Consolidate scope and define explicit acceptance criteria with team sign-off.",
    difficultyPoints: 2,
    skillHint: "Product Planning",
  },
  {
    title: "Set up project architecture and repo workflows",
    description:
      "Establish architecture decisions, coding standards, and CI baseline.",
    difficultyPoints: 3,
    skillHint: "Architecture",
  },
  {
    title: "Implement core feature slice",
    description:
      "Build the highest-value vertical slice that validates end-to-end behavior.",
    difficultyPoints: 5,
    skillHint: "Full Stack Development",
  },
  {
    title: "Implement secondary feature slice",
    description:
      "Build supporting functionality and integrate with existing core slice.",
    difficultyPoints: 3,
    skillHint: "Application Development",
  },
  {
    title: "Quality pass and hardening",
    description:
      "Run tests, fix defects, and improve reliability for demo readiness.",
    difficultyPoints: 2,
    skillHint: "QA",
  },
  {
    title: "Prepare final demo and delivery artifacts",
    description:
      "Package deployment, demo flow, and final documentation for submission.",
    difficultyPoints: 2,
    skillHint: "Communication",
  },
];

function buildFallbackTaskPlan(input: GenerateTaskPlanInput): AITaskPlanOutput {
  const chosenSkill = (hint: string) =>
    input.availableSkills.find((skill) =>
      skill.toLowerCase().includes(hint.toLowerCase()),
    ) ??
    input.availableSkills[0] ??
    "General Engineering";

  return {
    tasks: DEFAULT_PLAN_TEMPLATES.map((template, index) => {
      const tempId = `T${index + 1}`;
      const dependency = index === 0 ? [] : [`T${index}`];

      return {
        tempId,
        title: `${template.title} - ${input.projectName}`,
        description: template.description,
        difficultyPoints: template.difficultyPoints,
        dueAt: null,
        requiredSkills: [
          {
            skillName: chosenSkill(template.skillHint),
            weight: 4,
          },
        ],
        dependsOnTempIds: dependency,
      };
    }),
  };
}

async function callOpenAITaskPlan(
  input: GenerateTaskPlanInput,
): Promise<OpenAIPlanResult> {
  const env = getServerEnv();
  const model = env.OPENAI_MODEL;
  if (!env.OPENAI_API_KEY) {
    return {
      ok: false,
      reason: "missing_api_key",
      model,
    };
  }

  const contextText = input.contextBlocks
    .map((context) => `[${context.contextType}] ${context.textContent}`)
    .join("\n\n");

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "Generate a draft plan between 6 and 12 tasks. IDs must be temporary strings (tempId). Do not assign users.",
          },
          {
            role: "user",
            content: JSON.stringify({
              projectName: input.projectName,
              projectDescription: input.projectDescription,
              deadline: input.projectDeadline,
              contextText,
              availableSkills: input.availableSkills,
              rules: [
                "Use difficulty points from [1,2,3,5,8].",
                "Set status implicitly todo by returning only task planning data.",
                "Use dependsOnTempIds for finish-to-start dependencies.",
              ],
            }),
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "draft_task_plan",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                tasks: {
                  type: "array",
                  minItems: 6,
                  maxItems: 12,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      tempId: { type: "string", minLength: 1, maxLength: 50 },
                      title: { type: "string", minLength: 3, maxLength: 120 },
                      description: {
                        type: "string",
                        minLength: 10,
                        maxLength: 1000,
                      },
                      difficultyPoints: {
                        type: "integer",
                        enum: [1, 2, 3, 5, 8],
                      },
                      dueAt: {
                        anyOf: [
                          { type: "string", format: "date-time" },
                          { type: "null" },
                        ],
                      },
                      requiredSkills: {
                        type: "array",
                        maxItems: 8,
                        items: {
                          type: "object",
                          additionalProperties: false,
                          properties: {
                            skillName: {
                              type: "string",
                              minLength: 1,
                              maxLength: 80,
                            },
                            weight: { type: "number", minimum: 1, maximum: 5 },
                          },
                          required: ["skillName", "weight"],
                        },
                      },
                      dependsOnTempIds: {
                        type: "array",
                        maxItems: 8,
                        items: { type: "string", minLength: 1, maxLength: 50 },
                      },
                    },
                    required: [
                      "tempId",
                      "title",
                      "description",
                      "difficultyPoints",
                      "dueAt",
                      "requiredSkills",
                      "dependsOnTempIds",
                    ],
                  },
                },
              },
              required: ["tasks"],
            },
          },
        },
      }),
    });
  } catch {
    return {
      ok: false,
      reason: "provider_request_failed",
      model,
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      reason: "provider_http_error",
      model,
      status: response.status,
    };
  }

  let payload: {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  try {
    payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
  } catch {
    return {
      ok: false,
      reason: "invalid_provider_payload",
      model,
    };
  }

  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    return {
      ok: false,
      reason: "missing_provider_content",
      model,
    };
  }

  let parsedContent: unknown;
  try {
    parsedContent = JSON.parse(content) as unknown;
  } catch {
    return {
      ok: false,
      reason: "invalid_provider_payload",
      model,
    };
  }

  const parsed = aiTaskPlanOutputSchema.safeParse(parsedContent);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "schema_validation_failed",
      model,
    };
  }

  return {
    ok: true,
    plan: parsed.data,
    model,
  };
}

export async function generateTaskPlan(
  input: GenerateTaskPlanInput,
): Promise<GenerateTaskPlanResult> {
  const env = getServerEnv();
  const strictMode = env.OPENAI_STRICT_GENERATION;
  const modelPlan = await callOpenAITaskPlan(input);

  if (modelPlan.ok) {
    return {
      plan: modelPlan.plan,
      generation: {
        mode: "openai",
        model: modelPlan.model,
        strictMode,
        fallbackReason: null,
      },
    };
  }

  if (strictMode) {
    throw new AIGenerationUnavailableError(
      "Strict AI generation is enabled but OpenAI task generation was unavailable.",
      {
        reason: modelPlan.reason,
        model: modelPlan.model,
        status: modelPlan.status,
      },
    );
  }

  console.warn("Falling back to deterministic task plan generation.", {
    reason: modelPlan.reason,
    model: modelPlan.model,
  });

  return {
    plan: buildFallbackTaskPlan(input),
    generation: {
      mode: "fallback",
      model: modelPlan.model,
      strictMode,
      fallbackReason: modelPlan.reason,
    },
  };
}
