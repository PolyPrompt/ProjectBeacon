import {
  CLARIFICATION_CONFIDENCE_THRESHOLD,
  MAX_CLARIFICATION_QUESTIONS,
  getServerEnv,
} from "@/lib/server/env";
import {
  aiConfidenceOutputSchema,
  clarificationStateSchema,
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

  const systemPrompt =
    "You evaluate project context quality before task planning. Return JSON only, matching schema exactly.";

  const userPrompt = JSON.stringify({
    projectName: input.projectName,
    projectDescription: input.projectDescription,
    projectDeadline: input.projectDeadline,
    askedCount: input.askedCount,
    contexts: input.contexts,
    threshold: CLARIFICATION_CONFIDENCE_THRESHOLD,
    maxQuestions: MAX_CLARIFICATION_QUESTIONS,
  });

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
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
      temperature: 0,
    }),
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };

  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    return null;
  }

  const parsed = aiConfidenceOutputSchema.safeParse(JSON.parse(content));
  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

export async function buildClarificationState(
  input: BuildClarificationStateInput,
): Promise<ClarificationState> {
  const modelOutput =
    (await callOpenAIConfidence(input)) ?? buildHeuristicConfidence(input);

  const reachedQuestionLimit = input.askedCount >= MAX_CLARIFICATION_QUESTIONS;
  const belowThreshold =
    modelOutput.confidence < CLARIFICATION_CONFIDENCE_THRESHOLD;

  const state = {
    confidence: modelOutput.confidence,
    threshold: CLARIFICATION_CONFIDENCE_THRESHOLD,
    askedCount: input.askedCount,
    maxQuestions: MAX_CLARIFICATION_QUESTIONS,
    questions:
      reachedQuestionLimit || !belowThreshold
        ? []
        : modelOutput.followUpQuestions,
    assumptions:
      reachedQuestionLimit && belowThreshold
        ? modelOutput.assumptions
        : undefined,
    readyForGeneration: !belowThreshold || reachedQuestionLimit,
  };

  return clarificationStateSchema.parse(state);
}
