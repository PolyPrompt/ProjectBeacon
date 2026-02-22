import type { ProjectRole } from "@/types/roles";

export function isE2EAuthBypassEnabled(): boolean {
  return process.env.E2E_BYPASS_AUTH === "true";
}

export function getE2EBypassClerkUserId(): string {
  const configured = process.env.E2E_TEST_CLERK_USER_ID;
  if (configured && configured.trim().length > 0) {
    return configured.trim();
  }

  return "e2e-clerk-user";
}

export function getE2EBypassUserId(): string {
  const configured = process.env.E2E_TEST_USER_ID;
  if (configured && configured.trim().length > 0) {
    return configured.trim();
  }

  return "e2e-user";
}

export function getE2EBypassRole(): ProjectRole {
  return process.env.E2E_TEST_ROLE === "admin" ? "admin" : "user";
}
