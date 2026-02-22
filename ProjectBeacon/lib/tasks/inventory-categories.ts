import type { WorkflowBoardTaskDTO } from "@/types/workflow";

export type InventoryCategory =
  | "Research & Discovery"
  | "Planning & Coordination"
  | "Implementation & Production"
  | "Analysis & Validation"
  | "Writing & Documentation"
  | "Presentation & Submission";

export const INVENTORY_CATEGORY_ORDER: InventoryCategory[] = [
  "Research & Discovery",
  "Planning & Coordination",
  "Implementation & Production",
  "Analysis & Validation",
  "Writing & Documentation",
  "Presentation & Submission",
];

const CATEGORY_KEYWORDS: Record<InventoryCategory, RegExp> = {
  "Research & Discovery":
    /(research|discovery|investigat|literature|source review|background|hypothesis|explor|requirements gathering|field study)/,
  "Planning & Coordination":
    /(plan|timeline|roadmap|schedule|scope|milestone|outline|proposal|coordinat|organi[sz]e|work breakdown|meeting)/,
  "Implementation & Production":
    /(implement|build|develop|create|prototype|configure|integrat|code|model|construct|setup|experiment run|draft artifact)/,
  "Analysis & Validation":
    /(analys|evaluate|test|qa|validat|verify|debug|review|quality check|benchmark|results|proofread)/,
  "Writing & Documentation":
    /(write|draft|essay|report|paper|documentation|readme|citation|bibliograph|abstract|methodology|lab notebook|appendix)/,
  "Presentation & Submission":
    /(present|presentation|slides|poster|demo|submission|submit|final package|deliverable|publish|handoff)/,
};

function uniqueCategories(
  categories: InventoryCategory[],
): InventoryCategory[] {
  return [...new Set(categories)];
}

function fallbackCategories(
  task: WorkflowBoardTaskDTO,
): [InventoryCategory, InventoryCategory] {
  if (task.phase === "beginning") {
    return ["Research & Discovery", "Planning & Coordination"];
  }

  if (task.phase === "middle") {
    return ["Implementation & Production", "Analysis & Validation"];
  }

  return ["Writing & Documentation", "Presentation & Submission"];
}

export function isInventoryCategory(value: string): value is InventoryCategory {
  return INVENTORY_CATEGORY_ORDER.includes(value as InventoryCategory);
}

export function inferInventoryCategories(
  task: WorkflowBoardTaskDTO,
): InventoryCategory[] {
  const normalized = `${task.title} ${task.description ?? ""}`.toLowerCase();
  const matches = INVENTORY_CATEGORY_ORDER.filter((category) =>
    CATEGORY_KEYWORDS[category].test(normalized),
  );

  if (matches.length > 0) {
    return uniqueCategories(matches).slice(0, 3);
  }

  return fallbackCategories(task);
}
