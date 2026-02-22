import {
  aiTaskPlanOutputSchema,
  type AITaskPlanOutput,
} from "@/types/ai-output";
import { getTaskPlanSystemPrompt } from "@/lib/ai/prompt-registry";
import { resolveOpenAIModelForOperation } from "@/lib/ai/model-selection";
import { getOpenAIChatRequestTuning } from "@/lib/ai/openai-chat-options";
import { ApiHttpError } from "@/lib/server/errors";
import { getServerEnv } from "@/lib/server/env";

export type GenerateTaskPlanInput = {
  projectName: string;
  projectDescription: string;
  projectDeadline: string;
  contextBlocks: Array<{ contextType: string; textContent: string }>;
  availableSkills: string[];
  planningMode?: "standard" | "provisional";
  clarification?: {
    confidence: number;
    threshold: number;
    readyForGeneration: boolean;
    askedCount: number;
    maxQuestions: number;
  };
};

export type GenerationMode = "openai" | "fallback";

export type GenerationFallbackReason =
  | "missing_api_key"
  | "openai_http_error"
  | "empty_response"
  | "response_parse_error"
  | "response_schema_invalid"
  | "request_failed";

export type TaskPlanGenerationMetadata = {
  mode: GenerationMode;
  reason: GenerationFallbackReason | null;
  strictMode: boolean;
  planningMode: "standard" | "provisional";
  diagnostics?: {
    message: string;
    status?: number;
  };
};

export type GenerateTaskPlanResult = {
  plan: AITaskPlanOutput;
  generation: TaskPlanGenerationMetadata;
};

const OPENAI_TASK_PLAN_JSON_SCHEMA = {
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
            anyOf: [{ type: "string", format: "date-time" }, { type: "null" }],
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
} as const;

const OPENAI_TASK_PLAN_RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "draft_task_plan",
    strict: true,
    schema: OPENAI_TASK_PLAN_JSON_SCHEMA,
  },
} as const;

let hasLoggedTaskPlanSchema = false;
const OPENAI_RAW_RESPONSE_LOG_LIMIT = 4000;

function truncateForLog(
  value: string,
  maxLength = OPENAI_RAW_RESPONSE_LOG_LIMIT,
) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}... [truncated]`;
}

function logTaskPlanSchemaOnce(): void {
  if (hasLoggedTaskPlanSchema) {
    return;
  }

  hasLoggedTaskPlanSchema = true;
  console.info(
    "[generateTaskPlan] OpenAI response schema",
    JSON.stringify(OPENAI_TASK_PLAN_RESPONSE_FORMAT.json_schema.schema),
  );
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

const PROVISIONAL_PLAN_TEMPLATES: Array<{
  title: string;
  description: string;
  difficultyPoints: 1 | 2 | 3 | 5 | 8;
  skillHint: string;
}> = [
  {
    title: "Identify ambiguity gaps and research questions",
    description:
      "Document open questions, unknown assumptions, and data needed to unblock implementation planning.",
    difficultyPoints: 2,
    skillHint: "Product Planning",
  },
  {
    title: "Run technical discovery and feasibility spikes",
    description:
      "Evaluate architecture options, integration risks, and tooling constraints for unresolved requirements.",
    difficultyPoints: 3,
    skillHint: "Architecture",
  },
  {
    title: "Create provisional architecture and delivery baseline",
    description:
      "Draft a first-pass architecture and sequence with explicit assumption markers for later revision.",
    difficultyPoints: 3,
    skillHint: "System Design",
  },
  {
    title: "Implement low-risk foundation tasks",
    description:
      "Execute setup, scaffolding, and reusable baseline work that remains valid even if requirements evolve.",
    difficultyPoints: 3,
    skillHint: "Full Stack Development",
  },
  {
    title: "Validate assumptions with stakeholders",
    description:
      "Review discovery findings, confirm priorities, and convert assumptions into explicit acceptance criteria.",
    difficultyPoints: 2,
    skillHint: "Communication",
  },
  {
    title: "Replan backlog from validated findings",
    description:
      "Recompute confidence and generate refined implementation tasks using updated context and confirmed constraints.",
    difficultyPoints: 2,
    skillHint: "Product Planning",
  },
];

function buildFallbackTaskPlan(input: GenerateTaskPlanInput): AITaskPlanOutput {
  const templates =
    input.planningMode === "provisional"
      ? PROVISIONAL_PLAN_TEMPLATES
      : DEFAULT_PLAN_TEMPLATES;
  const chosenSkill = (hint: string) =>
    input.availableSkills.find((skill) =>
      skill.toLowerCase().includes(hint.toLowerCase()),
    ) ??
    input.availableSkills[0] ??
    "General Engineering";

  return {
    tasks: templates.map((template, index) => {
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

type OpenAITaskPlanAttempt =
  | {
      ok: true;
      plan: AITaskPlanOutput;
    }
  | {
      ok: false;
      reason: GenerationFallbackReason;
      diagnostics: {
        message: string;
        status?: number;
      };
    };

async function callOpenAITaskPlan(
  input: GenerateTaskPlanInput,
): Promise<OpenAITaskPlanAttempt> {
  const env = getServerEnv();
  if (!env.OPENAI_API_KEY) {
    return {
      ok: false,
      reason: "missing_api_key",
      diagnostics: {
        message: "OPENAI_API_KEY is not configured.",
      },
    };
  }

  const contextText = input.contextBlocks
    .map((context) => `[${context.contextType}] ${context.textContent}`)
    .join("\n\n");
  const model = resolveOpenAIModelForOperation(env, "task_plan");
  const systemPrompt = getTaskPlanSystemPrompt();
  const planningMode = input.planningMode ?? "standard";

  logTaskPlanSchemaOnce();

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
        ...getOpenAIChatRequestTuning(model),
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: JSON.stringify({
              projectName: input.projectName,
              projectDescription: input.projectDescription,
              deadline: input.projectDeadline,
              contextText,
              availableSkills: input.availableSkills,
              planningMode,
              clarification: input.clarification,
            }),
          },
        ],
        response_format: OPENAI_TASK_PLAN_RESPONSE_FORMAT,
      }),
    });
  } catch (error) {
    return {
      ok: false,
      reason: "request_failed",
      diagnostics: {
        message:
          error instanceof Error
            ? `OpenAI request failed: ${error.message}`
            : "OpenAI request failed due to an unexpected error.",
      },
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      reason: "openai_http_error",
      diagnostics: {
        message: `OpenAI returned HTTP ${response.status}.`,
        status: response.status,
      },
    };
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };

  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    return {
      ok: false,
      reason: "empty_response",
      diagnostics: {
        message: "OpenAI response did not contain a task plan payload.",
      },
    };
  }
  console.info("[generateTaskPlan] OpenAI raw response content", {
    contentLength: content.length,
    preview: truncateForLog(content),
  });

  let candidate: unknown;
  try {
    candidate = JSON.parse(content);
  } catch {
    return {
      ok: false,
      reason: "response_parse_error",
      diagnostics: {
        message: "OpenAI task plan payload was not valid JSON.",
      },
    };
  }

  const parsed = aiTaskPlanOutputSchema.safeParse(candidate);
  if (!parsed.success) {
    console.warn("[generateTaskPlan] response schema validation failed", {
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        code: issue.code,
        message: issue.message,
      })),
      rawContentPreview: truncateForLog(content),
    });

    return {
      ok: false,
      reason: "response_schema_invalid",
      diagnostics: {
        message: "OpenAI task plan payload did not match expected schema.",
      },
    };
  }

  return {
    ok: true,
    plan: parsed.data,
  };
}

export async function generateTaskPlan(
  input: GenerateTaskPlanInput,
  options: { strictMode?: boolean } = {},
): Promise<GenerateTaskPlanResult> {
  const planningMode = input.planningMode ?? "standard";
  const strictMode = options.strictMode ?? false;
  const modelPlan = await callOpenAITaskPlan(input);
  if (modelPlan.ok) {
    return {
      plan: modelPlan.plan,
      generation: {
        mode: "openai",
        reason: null,
        strictMode,
        planningMode,
      },
    };
  }

  console.warn("[generateTaskPlan] using fallback plan", {
    reason: modelPlan.reason,
    status: modelPlan.diagnostics.status,
    message: modelPlan.diagnostics.message,
  });

  if (strictMode) {
    throw new ApiHttpError(
      503,
      "AI_GENERATION_UNAVAILABLE",
      "AI generation strict mode is enabled and OpenAI generation is unavailable.",
      {
        mode: "openai",
        reason: modelPlan.reason,
        diagnostics: modelPlan.diagnostics,
      },
    );
  }

  return {
    plan: buildFallbackTaskPlan(input),
    generation: {
      mode: "fallback",
      reason: modelPlan.reason,
      strictMode,
      planningMode,
      diagnostics: modelPlan.diagnostics,
    },
  };
}
