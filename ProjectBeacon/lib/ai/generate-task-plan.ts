import {
  aiTaskPlanOutputSchema,
  type AITaskPlanOutput,
} from "@/types/ai-output";
import { getTaskPlanSystemPrompt } from "@/lib/ai/prompt-registry";
import { resolveOpenAIModelForOperation } from "@/lib/ai/model-selection";
import { getOpenAIChatRequestTuning } from "@/lib/ai/openai-chat-options";
import { requestOpenAIChatCompletions } from "@/lib/ai/openai-chat-request";
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
  model: string | null;
  latencyMs: number | null;
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

function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

const DEFAULT_PLAN_TEMPLATES: Array<{
  title: string;
  description: string;
  difficultyPoints: 1 | 2 | 3 | 5 | 8;
  skillHint: string;
}> = [
  {
    title: "Confirm deliverables, rubric, and success criteria",
    description:
      "Review assignment requirements, define scope boundaries, and agree on measurable completion criteria.",
    difficultyPoints: 2,
    skillHint: "Planning",
  },
  {
    title: "Collect sources, data, and reference materials",
    description:
      "Gather required literature, datasets, lab resources, or references needed to execute the project.",
    difficultyPoints: 3,
    skillHint: "Research",
  },
  {
    title: "Build first complete draft or prototype",
    description:
      "Produce the first end-to-end version of the core project artifact, report section, or implementation output.",
    difficultyPoints: 5,
    skillHint: "Execution",
  },
  {
    title: "Analyze outcomes and close quality gaps",
    description:
      "Evaluate results, test assumptions, and revise weak sections based on findings or feedback.",
    difficultyPoints: 3,
    skillHint: "Analysis",
  },
  {
    title: "Finalize written materials and documentation",
    description:
      "Complete final writing, citations, method notes, and documentation required for grading or review.",
    difficultyPoints: 2,
    skillHint: "Writing",
  },
  {
    title: "Prepare presentation and submission package",
    description:
      "Assemble slides/poster/demo assets and ensure all required submission artifacts are complete.",
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
    title: "Identify ambiguity gaps and open questions",
    description:
      "Capture unresolved requirements, assumptions, and missing inputs that block reliable planning.",
    difficultyPoints: 2,
    skillHint: "Planning",
  },
  {
    title: "Run discovery and feasibility checks",
    description:
      "Evaluate candidate approaches, evidence needs, and practical constraints for unclear project directions.",
    difficultyPoints: 3,
    skillHint: "Research",
  },
  {
    title: "Draft provisional plan and milestone baseline",
    description:
      "Create an initial sequence of work with explicit assumption markers so the team can revise safely.",
    difficultyPoints: 3,
    skillHint: "Planning",
  },
  {
    title: "Execute low-risk foundation tasks",
    description:
      "Complete baseline work that is useful even if details change, such as source collection, templates, or environment setup.",
    difficultyPoints: 3,
    skillHint: "Execution",
  },
  {
    title: "Validate assumptions with stakeholders",
    description:
      "Review findings with stakeholders, confirm priorities, and convert assumptions into explicit requirements.",
    difficultyPoints: 2,
    skillHint: "Communication",
  },
  {
    title: "Regenerate plan from validated findings",
    description:
      "Recompute confidence and replace provisional work with refined execution tasks using confirmed context.",
    difficultyPoints: 2,
    skillHint: "Planning",
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
    "General Collaboration";

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
      model: string;
      latencyMs: number;
    }
  | {
      ok: false;
      reason: GenerationFallbackReason;
      model: string | null;
      latencyMs: number | null;
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
      model: null,
      latencyMs: null,
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
  const requestStartedAt = nowMs();

  logTaskPlanSchemaOnce();

  let response: Response;
  try {
    const result = await requestOpenAIChatCompletions({
      apiKey: env.OPENAI_API_KEY,
      body: {
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
      },
    });
    response = result.response;
  } catch (error) {
    return {
      ok: false,
      reason: "request_failed",
      model,
      latencyMs: Math.max(1, Math.round(nowMs() - requestStartedAt)),
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
      model,
      latencyMs: Math.max(1, Math.round(nowMs() - requestStartedAt)),
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
      model,
      latencyMs: Math.max(1, Math.round(nowMs() - requestStartedAt)),
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
      model,
      latencyMs: Math.max(1, Math.round(nowMs() - requestStartedAt)),
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
      model,
      latencyMs: Math.max(1, Math.round(nowMs() - requestStartedAt)),
      diagnostics: {
        message: "OpenAI task plan payload did not match expected schema.",
      },
    };
  }

  return {
    ok: true,
    plan: parsed.data,
    model,
    latencyMs: Math.max(1, Math.round(nowMs() - requestStartedAt)),
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
        model: modelPlan.model,
        latencyMs: modelPlan.latencyMs,
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
        model: modelPlan.model,
        latencyMs: modelPlan.latencyMs,
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
      model: modelPlan.model,
      latencyMs: modelPlan.latencyMs,
      diagnostics: modelPlan.diagnostics,
    },
  };
}
