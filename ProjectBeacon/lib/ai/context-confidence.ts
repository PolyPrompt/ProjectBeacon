import {
  CLARIFICATION_CONFIDENCE_THRESHOLD,
  MAX_CLARIFICATION_QUESTIONS,
  getServerEnv,
} from "@/lib/server/env";
import { resolveOpenAIModelForOperation } from "@/lib/ai/model-selection";
import { getOpenAIChatRequestTuning } from "@/lib/ai/openai-chat-options";
import {
  getClarifyingQuestionsSystemPrompt,
  getConfidenceSystemPrompt,
} from "@/lib/ai/prompt-registry";
import {
  aiClarifyingQuestionsOutputSchema,
  aiConfidenceOutputSchema,
  clarificationStateSchema,
  type AIClarifyingQuestionsOutput,
  type AIConfidenceOutput,
  type ClarificationState,
} from "@/types/ai-output";

export type ProjectContextRow = {
  id: string;
  context_type:
    | "initial"
    | "clarification_qa"
    | "assumption"
    | "document_extract";
  text_content: string;
};

type BuildClarificationStateInput = {
  projectName: string;
  projectDescription: string;
  projectDeadline: string;
  contexts: ProjectContextRow[];
  askedCount: number;
};

type GenerateClarifyingQuestionsInput = BuildClarificationStateInput & {
  confidence: number;
  fallbackQuestions: string[];
};

function extractMissingAreas(fullText: string): string[] {
  const checks: Array<{ key: string; patterns: RegExp[] }> = [
    { key: "deliverables", patterns: [/deliverable/i, /output/i, /submit/i] },
    { key: "stack", patterns: [/tech/i, /stack/i, /framework/i, /language/i] },
    {
      key: "timeline",
      patterns: [/deadline/i, /milestone/i, /date/i, /week/i],
    },
    {
      key: "constraints",
      patterns: [/constraint/i, /must/i, /cannot/i, /limit/i],
    },
  ];

  return checks
    .filter(
      (check) => !check.patterns.some((pattern) => pattern.test(fullText)),
    )
    .map((check) => check.key);
}

function buildHeuristicConfidence(
  input: BuildClarificationStateInput,
): AIConfidenceOutput {
  const combinedText = `${input.projectName}\n${input.projectDescription}\n${input.contexts
    .map((row) => row.text_content)
    .join("\n")}`;

  const wordCount = combinedText.split(/\s+/).filter(Boolean).length;
  const missingAreas = extractMissingAreas(combinedText);

  let confidence = 35 + Math.min(35, Math.floor(wordCount / 25));
  confidence += Math.max(0, 20 - missingAreas.length * 5);
  confidence = Math.max(0, Math.min(99, confidence));

  const followUpQuestions: string[] = [];
  if (missingAreas.includes("deliverables")) {
    followUpQuestions.push(
      "What are the required deliverables for this project?",
    );
  }
  if (missingAreas.includes("stack")) {
    followUpQuestions.push("Which technologies or frameworks are mandatory?");
  }
  if (missingAreas.includes("timeline")) {
    followUpQuestions.push(
      "What milestones should be completed before the final deadline?",
    );
  }
  if (missingAreas.includes("constraints")) {
    followUpQuestions.push(
      "Are there constraints or non-negotiable requirements the team must follow?",
    );
  }

  const assumptions = missingAreas.map((area) => {
    if (area === "deliverables")
      return "Assume standard MVP deliverables: working app, short report, and demo.";
    if (area === "stack")
      return "Assume the team can choose technologies already familiar to members.";
    if (area === "timeline")
      return "Assume even milestone spacing between now and the project deadline.";
    return "Assume no hidden constraints beyond explicitly provided requirements.";
  });

  return {
    confidence,
    followUpQuestions: followUpQuestions.slice(0, 3),
    assumptions: assumptions.slice(0, 5),
  };
}

async function callOpenAIConfidence(
  input: BuildClarificationStateInput,
): Promise<AIConfidenceOutput | null> {
  const env = getServerEnv();
  if (!env.OPENAI_API_KEY) {
    return null;
  }

  const userPrompt = JSON.stringify({
    projectName: input.projectName,
    projectDescription: input.projectDescription,
    projectDeadline: input.projectDeadline,
    askedCount: input.askedCount,
    contexts: input.contexts,
    threshold: CLARIFICATION_CONFIDENCE_THRESHOLD,
    maxQuestions: MAX_CLARIFICATION_QUESTIONS,
  });

  const model = resolveOpenAIModelForOperation(env, "confidence");
  const systemPrompt = getConfidenceSystemPrompt();

  async function requestConfidence(selectedModel: string): Promise<Response> {
    return fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: selectedModel,
        ...getOpenAIChatRequestTuning(selectedModel),
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "context_confidence",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                confidence: { type: "number", minimum: 0, maximum: 100 },
                followUpQuestions: {
                  type: "array",
                  items: { type: "string", minLength: 1, maxLength: 200 },
                  maxItems: 3,
                },
                assumptions: {
                  type: "array",
                  items: { type: "string", minLength: 1, maxLength: 300 },
                  maxItems: 5,
                },
              },
              required: ["confidence", "followUpQuestions", "assumptions"],
            },
          },
        },
      }),
    });
  }

  let requestedModel = model;
  let response = await requestConfidence(requestedModel);

  const fallbackModel =
    env.OPENAI_MODEL && env.OPENAI_MODEL.trim().length > 0
      ? env.OPENAI_MODEL
      : "gpt-4o-mini";
  if (
    response.status === 404 &&
    requestedModel !== fallbackModel &&
    fallbackModel.trim().length > 0
  ) {
    console.warn("[context-confidence] OpenAI model unavailable, retrying", {
      attemptedModel: requestedModel,
      fallbackModel,
    });
    requestedModel = fallbackModel;
    response = await requestConfidence(requestedModel);
  }

  if (!response.ok) {
    const errorBody = await response.text();
    console.warn("[context-confidence] OpenAI confidence request failed", {
      status: response.status,
      model: requestedModel,
      error: errorBody.slice(0, 500),
    });
    return null;
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };

  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    console.warn("[context-confidence] OpenAI confidence response was empty");
    return null;
  }

  let candidate: unknown;
  try {
    candidate = JSON.parse(content);
  } catch {
    console.warn(
      "[context-confidence] OpenAI confidence response was not JSON",
    );
    return null;
  }

  const parsed = aiConfidenceOutputSchema.safeParse(candidate);
  if (!parsed.success) {
    console.warn("[context-confidence] OpenAI confidence schema mismatch", {
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        code: issue.code,
        message: issue.message,
      })),
    });
    return null;
  }

  return parsed.data;
}

export async function buildClarificationState(
  input: BuildClarificationStateInput,
): Promise<ClarificationState> {
  const heuristicOutput = buildHeuristicConfidence(input);
  const modelOutput = (await callOpenAIConfidence(input)) ?? heuristicOutput;
  const followUpQuestions =
    modelOutput.followUpQuestions.length > 0
      ? modelOutput.followUpQuestions
      : heuristicOutput.followUpQuestions;
  const assumptions =
    modelOutput.assumptions.length > 0
      ? modelOutput.assumptions
      : heuristicOutput.assumptions;

  const reachedQuestionLimit = input.askedCount >= MAX_CLARIFICATION_QUESTIONS;
  const belowThreshold =
    modelOutput.confidence < CLARIFICATION_CONFIDENCE_THRESHOLD;

  const state = {
    confidence: modelOutput.confidence,
    threshold: CLARIFICATION_CONFIDENCE_THRESHOLD,
    askedCount: input.askedCount,
    maxQuestions: MAX_CLARIFICATION_QUESTIONS,
    questions: reachedQuestionLimit || !belowThreshold ? [] : followUpQuestions,
    assumptions:
      reachedQuestionLimit && belowThreshold ? assumptions : undefined,
    readyForGeneration: !belowThreshold || reachedQuestionLimit,
  };

  return clarificationStateSchema.parse(state);
}

function dedupeQuestions(questions: string[], maxItems: number): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const question of questions) {
    const normalized = question.trim();
    if (normalized.length === 0) {
      continue;
    }

    if (seen.has(normalized.toLowerCase())) {
      continue;
    }

    seen.add(normalized.toLowerCase());
    output.push(normalized);
    if (output.length >= maxItems) {
      break;
    }
  }

  return output;
}

function buildClarifyingQuestionsFallback(
  input: GenerateClarifyingQuestionsInput,
): string[] {
  const remainingBudget = Math.max(
    0,
    MAX_CLARIFICATION_QUESTIONS - input.askedCount,
  );
  const maxItems = Math.min(5, remainingBudget);
  if (maxItems === 0) {
    return [];
  }

  const fromModelOrConfidence = dedupeQuestions(
    input.fallbackQuestions,
    maxItems,
  );
  if (fromModelOrConfidence.length > 0) {
    return fromModelOrConfidence;
  }

  const combinedText = `${input.projectName}\n${input.projectDescription}\n${input.contexts
    .map((row) => row.text_content)
    .join("\n")}`;
  const missingAreas = extractMissingAreas(combinedText);

  const generated: string[] = [];
  if (missingAreas.includes("deliverables")) {
    generated.push("What final deliverables are required for submission?");
  }
  if (missingAreas.includes("timeline")) {
    generated.push("What deadline and milestone dates should the plan follow?");
  }
  if (missingAreas.includes("constraints")) {
    generated.push(
      "What non-negotiable constraints or requirements must the team follow?",
    );
  }
  if (missingAreas.includes("stack")) {
    generated.push(
      "Are there required technologies, frameworks, or deployment platforms?",
    );
  }

  if (generated.length === 0) {
    generated.push(
      "What are the core required features for the first complete version?",
    );
  }

  return dedupeQuestions(generated, maxItems);
}

async function callOpenAIClarifyingQuestions(
  input: GenerateClarifyingQuestionsInput,
): Promise<AIClarifyingQuestionsOutput | null> {
  const env = getServerEnv();
  if (!env.OPENAI_API_KEY) {
    return null;
  }

  const model = resolveOpenAIModelForOperation(env, "confidence");
  const systemPrompt = getClarifyingQuestionsSystemPrompt();
  const remainingBudget = Math.max(
    0,
    MAX_CLARIFICATION_QUESTIONS - input.askedCount,
  );
  if (remainingBudget === 0) {
    return null;
  }

  const userPrompt = JSON.stringify({
    projectName: input.projectName,
    projectDescription: input.projectDescription,
    projectDeadline: input.projectDeadline,
    confidence: input.confidence,
    askedCount: input.askedCount,
    maxQuestionsAllowed: remainingBudget,
    contexts: input.contexts,
  });

  async function requestClarifyingQuestions(
    selectedModel: string,
  ): Promise<Response> {
    return fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: selectedModel,
        ...getOpenAIChatRequestTuning(selectedModel),
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "clarifying_question_plan",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                clarification_questions: {
                  type: "array",
                  items: { type: "string", minLength: 1, maxLength: 200 },
                  maxItems: 5,
                },
                reasoning: { type: "string", minLength: 1, maxLength: 600 },
              },
              required: ["clarification_questions", "reasoning"],
            },
          },
        },
      }),
    });
  }

  let requestedModel = model;
  let response = await requestClarifyingQuestions(requestedModel);

  const fallbackModel =
    env.OPENAI_MODEL && env.OPENAI_MODEL.trim().length > 0
      ? env.OPENAI_MODEL
      : "gpt-4o-mini";
  if (
    response.status === 404 &&
    requestedModel !== fallbackModel &&
    fallbackModel.trim().length > 0
  ) {
    console.warn("[clarify-questions] OpenAI model unavailable, retrying", {
      attemptedModel: requestedModel,
      fallbackModel,
    });
    requestedModel = fallbackModel;
    response = await requestClarifyingQuestions(requestedModel);
  }

  if (!response.ok) {
    const errorBody = await response.text();
    console.warn("[clarify-questions] OpenAI clarify request failed", {
      status: response.status,
      model: requestedModel,
      error: errorBody.slice(0, 500),
    });
    return null;
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    console.warn("[clarify-questions] OpenAI clarify response was empty");
    return null;
  }

  let candidate: unknown;
  try {
    candidate = JSON.parse(content);
  } catch {
    console.warn("[clarify-questions] OpenAI clarify response was not JSON");
    return null;
  }

  const parsed = aiClarifyingQuestionsOutputSchema.safeParse(candidate);
  if (!parsed.success) {
    console.warn("[clarify-questions] OpenAI clarify schema mismatch", {
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        code: issue.code,
        message: issue.message,
      })),
    });
    return null;
  }

  return parsed.data;
}

export async function generateClarificationQuestions(
  input: GenerateClarifyingQuestionsInput,
): Promise<string[]> {
  if (input.askedCount >= MAX_CLARIFICATION_QUESTIONS) {
    return [];
  }

  if (input.confidence >= CLARIFICATION_CONFIDENCE_THRESHOLD) {
    return [];
  }

  const remainingBudget = Math.max(
    0,
    MAX_CLARIFICATION_QUESTIONS - input.askedCount,
  );
  const fallbackQuestions = buildClarifyingQuestionsFallback(input);
  const modelOutput = await callOpenAIClarifyingQuestions(input);
  if (!modelOutput) {
    return dedupeQuestions(fallbackQuestions, Math.min(5, remainingBudget));
  }

  const fromModel = dedupeQuestions(
    modelOutput.clarification_questions,
    Math.min(5, remainingBudget),
  );
  if (fromModel.length > 0) {
    return fromModel;
  }

  return dedupeQuestions(fallbackQuestions, Math.min(5, remainingBudget));
}
