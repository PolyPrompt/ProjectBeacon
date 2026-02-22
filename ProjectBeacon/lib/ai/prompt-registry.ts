import { readFileSync } from "node:fs";
import path from "node:path";

type PromptKey =
  | "task_plan"
  | "confidence"
  | "clarifying_questions"
  | "task_assignment";

const promptFileMap: Record<PromptKey, string[]> = {
  task_plan: ["TASK_PLAN.md"],
  confidence: ["CONFIDENCE_PROMPT.md"],
  clarifying_questions: ["CLARIFYING_Q_GEN.md"],
  task_assignment: ["TASK_ASSIGNMENT.md"],
};

const promptFallbackMap: Record<PromptKey, string> = {
  task_plan:
    "You are an expert technical project planner. Return JSON only and follow the response schema.",
  confidence:
    "You evaluate project context quality before task planning. Return JSON only that matches the response schema.",
  clarifying_questions:
    "You generate clarification questions for ambiguous project context. Return JSON only that matches the response schema.",
  task_assignment:
    "You assign unassigned todo tasks to project members. Return JSON only and follow the response schema.",
};

const promptCache = new Map<PromptKey, string>();
const promptLogState = new Set<PromptKey>();

function getPromptFilePath(fileName: string): string {
  return path.join(process.cwd(), "lib/ai/prompts", fileName);
}

function readPromptFile(fileName: string): string {
  return readFileSync(getPromptFilePath(fileName), "utf8").trim();
}

function logPromptSource(
  key: PromptKey,
  source: "markdown" | "fallback",
  details?: Record<string, string>,
): void {
  if (promptLogState.has(key)) {
    return;
  }

  promptLogState.add(key);
  if (source === "markdown") {
    console.info(`[ai-prompt] loaded ${key} prompt from markdown`);
    return;
  }

  console.warn(`[ai-prompt] using fallback ${key} prompt`, details);
}

function loadPrompt(key: PromptKey): string {
  const cached = promptCache.get(key);
  if (cached) {
    return cached;
  }

  const fileNames = promptFileMap[key];
  const markdownParts: string[] = [];

  for (const fileName of fileNames) {
    try {
      const content = readPromptFile(fileName);
      if (content.length > 0) {
        markdownParts.push(content);
      }
    } catch (error) {
      logPromptSource(key, "fallback", {
        message: error instanceof Error ? error.message : "Unknown read error",
      });
      const fallback = promptFallbackMap[key];
      promptCache.set(key, fallback);
      return fallback;
    }
  }

  if (markdownParts.length > 0) {
    const merged = markdownParts.join("\n\n");
    promptCache.set(key, merged);
    logPromptSource(key, "markdown");
    return merged;
  }

  const fallback = promptFallbackMap[key];
  promptCache.set(key, fallback);
  logPromptSource(key, "fallback", {
    message: "Prompt markdown files were empty.",
  });
  return fallback;
}

export function getTaskPlanSystemPrompt(): string {
  return loadPrompt("task_plan");
}

export function getConfidenceSystemPrompt(): string {
  return loadPrompt("confidence");
}

export function getTaskAssignmentSystemPrompt(): string {
  return loadPrompt("task_assignment");
}

export function getClarifyingQuestionsSystemPrompt(): string {
  return loadPrompt("clarifying_questions");
}
