import { ApiHttpError } from "@/lib/api/errors";
import { getServiceSupabaseClient } from "@/lib/supabase/server";

export async function ensureSkillByName(
  skillName: string,
): Promise<{ id: string; name: string }> {
  const normalized = skillName.trim();

  if (!normalized) {
    throw new ApiHttpError(400, "VALIDATION_ERROR", "Skill name is required");
  }

  const supabase = getServiceSupabaseClient();

  const { data: existing, error: existingError } = await supabase
    .from("skills")
    .select("id,name")
    .ilike("name", normalized)
    .maybeSingle();

  if (existingError) {
    throw new ApiHttpError(
      500,
      "DB_ERROR",
      "Failed reading skill catalog",
      existingError.message,
    );
  }

  if (existing) {
    return existing;
  }

  const { data: created, error: createError } = await supabase
    .from("skills")
    .insert({ name: normalized })
    .select("id,name")
    .single();

  if (createError) {
    throw new ApiHttpError(
      500,
      "DB_ERROR",
      "Failed creating skill",
      createError.message,
    );
  }

  return created;
}
