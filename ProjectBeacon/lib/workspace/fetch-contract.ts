export type ProjectApiResponse = {
  id: string;
  name: string;
  description: string;
  deadline: string;
  ownerUserId: string;
  planningStatus: "draft" | "locked" | "assigned";
};

export type MembersApiResponse = {
  members: Array<{
    userId: string;
    name: string;
    email: string;
    role: "owner" | "member";
  }>;
};

export type ConfidenceApiResponse = {
  confidence: number;
  threshold: number;
  askedCount: number;
  maxQuestions: number;
  readyForGeneration: boolean;
};

export async function fetchContract<T>(
  path: string,
  init?: RequestInit,
): Promise<T | null> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}
