import type { Database } from "@/types/db";

export type ProjectPayload = {
  id: string;
  name: string;
  description: string;
  deadline: string;
  ownerUserId: string;
  planningStatus: "draft" | "locked" | "assigned";
};

export function toProjectPayload(
  row: Database["public"]["Tables"]["projects"]["Row"],
): ProjectPayload {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    deadline: row.deadline,
    ownerUserId: row.owner_user_id,
    planningStatus: row.planning_status,
  };
}
