import { insertRows, selectRows } from "@/lib/server/supabase-rest";
import type { ProjectContextRow } from "@/lib/ai/context-confidence";

export async function fetchActiveProjectContexts(
  projectId: string,
): Promise<ProjectContextRow[]> {
  const rows = await selectRows<ProjectContextRow>("project_contexts", {
    select: "id,context_type,text_content",
    project_id: `eq.${projectId}`,
    status: "eq.active",
    order: "created_at.asc",
  });

  return rows;
}

export async function appendProjectContextEntry(params: {
  projectId: string;
  createdByUserId: string;
  contextType: "clarification_qa" | "assumption";
  title: string;
  textContent: string;
}): Promise<void> {
  await insertRows("project_contexts", {
    project_id: params.projectId,
    source_type: "text",
    context_type: params.contextType,
    title: params.title,
    text_content: params.textContent,
    status: "active",
    created_by_user_id: params.createdByUserId,
  });
}

export function countClarificationEntries(
  contexts: ProjectContextRow[],
): number {
  return contexts.filter(
    (context) => context.context_type === "clarification_qa",
  ).length;
}
