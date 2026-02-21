# Decisions Log

## 2026-02-21T12:56:26Z

- Decision summary: Standardize API behavior around shared server utilities (`lib/env.ts`, `lib/auth/require-user.ts`, `lib/supabase/server.ts`, `lib/api/errors.ts`).
- Rationale: Agent1 endpoints needed consistent auth checks, env validation, and error contract responses (`{ error: { code, message, details? } }`) to avoid duplicated route logic.
- Alternatives considered:
  - Per-route ad hoc checks and inline client construction.
  - Middleware-only auth enforcement without local user resolution.
- Impact on files/behavior:
  - Added shared env/auth/Supabase/OpenAI helpers.
  - All new API routes use shared error handling and authenticated user resolution.

## 2026-02-21T12:56:26Z

- Decision summary: Lock strict MVP schema in a single migration with project-scoped dependency constraints and local Clerk user identity column (`users.clerk_user_id`).
- Rationale: Task and dependency correctness requires preventing invalid cross-project dependency links; identity sync requires stable Clerk-to-local user mapping.
- Alternatives considered:
  - Enforce dependency validity only in application code.
  - Use email-only identity linkage without dedicated Clerk identifier.
- Impact on files/behavior:
  - Added `supabase/migrations/20260221_000001_mvp_schema.sql` with constraints/checks/indexes/triggers.
  - Added `types/db.ts` for stable schema typing.
  - Updated `DATAMODEL.md` to reflect implemented schema deltas.

## 2026-02-21T12:56:26Z

- Decision summary: Validate builds with webpack mode in this environment.
- Rationale: Default Turbopack build path failed in sandbox due process/port restrictions; webpack build succeeded and verified routes/types.
- Alternatives considered:
  - Keep Turbopack-only build and treat as unresolved blocker.
  - Remove build verification entirely.
- Impact on files/behavior:
  - Verification command used: `npm run build -- --webpack`.
  - Kept default build script unchanged; documented verification method in handoff.

## 2026-02-21T13:17:28Z

- Decision summary: Add a Vitest-based unit test harness for agent1 backend logic and keep tests unit-scoped with mocked service clients.
- Rationale: Agent1 CRUD/share/docs code needed repeatable local verification without requiring live Clerk/Supabase credentials or network calls.
- Alternatives considered:
  - Keep only lint/build checks and skip unit tests.
  - Use Node built-in test runner with custom mocking wrappers.
- Impact on files/behavior:
  - Added `vitest` + `npm test`, `vitest.config.ts`, and test setup defaults.
  - Added unit tests for project create route behavior, share-token helpers, document upload helper, and project DTO mapping.
