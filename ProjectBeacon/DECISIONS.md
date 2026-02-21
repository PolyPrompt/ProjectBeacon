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


# Decision Log

## 2026-02-21T12:35:22Z

- Decision summary: Continue agent2 implementation from local `tasks.md` and contracts despite GitHub issue-sync and branch-creation blockers.
- Rationale: MCP GitHub issue search could not access the repository, and local git refs are not writable from this sandbox; stopping would leave the overnight agent2 scope unimplemented.
- Alternatives considered:
  - Stop immediately and wait for manual issue synchronization.
  - Implement nothing beyond blocker notes.
- Impact on files or behavior:
  - Work tracking is mirrored in `HANDOFF.local.md` and `HANDOFF.md` instead of GitHub issue status updates.

## 2026-02-21T12:49:31Z

- Decision summary: Implement the full agent2 planning pipeline with direct Supabase REST + fetch-based OpenAI calls, with strict Zod validation at route boundaries.
- Rationale: Agent1 foundation dependencies are not landed in this workspace; using REST keeps agent2 APIs functional without taking ownership of agent1 SDK bootstrap tasks.
- Alternatives considered:
  - Block all API implementation and create schemas-only prep.
  - Add new SDK dependencies (`@supabase/supabase-js`, `openai`, `@clerk/nextjs`) and build around missing foundation code.
- Impact on files or behavior:
  - New route handlers under `app/api/projects/[projectId]/**` and `app/api/task-reassignment-requests/[requestId]/respond/route.ts`.
  - New shared modules under `lib/ai`, `lib/assignment`, `lib/server`, and `lib/tasks`.
  - Auth in these routes currently uses header-based identity (`x-user-id`/`x-projectbeacon-user-id`) as an interim contract.

## 2026-02-21T12:49:31Z

- Decision summary: Enforce deterministic planning transitions and replan stability/fairness in backend policies.
- Rationale: User requirements and API contract require deterministic `draft -> locked -> assigned` and controlled reassignment/replan behavior to minimize churn.
- Alternatives considered:
  - Allow looser state changes from any planning status.
  - Reassign all tasks on each replan for pure best-skill optimization.
- Impact on files or behavior:
  - Transition guard in `lib/tasks/planning-status.ts` and lock/assignment routes.
  - Cycle validation in `lib/tasks/validate-dependency-graph.ts` and generation/replan routes.
  - Fairness-aware assignment + replan stability in `lib/assignment/assign-tasks.ts` and `lib/assignment/replan-policy.ts`.

## 2026-02-21T18:07:34Z

- Decision summary: Harden reassignment error handling with explicit HTTP error types and validate replan dependency references/cycles before mutating data.
- Rationale: Contract requires stable `401/403/4xx` behavior for auth/validation failures, and replan should reject invalid dependency payloads before partial writes.
- Alternatives considered:
  - Keep generic thrown errors and let route mapper return `500` for semantic validation failures.
  - Validate dependencies only after task writes, accepting possible partial mutation on invalid payloads.
- Impact on files or behavior:
  - Added `ApiHttpError` and route-level mapping in `lib/server/errors.ts` and `lib/server/route-helpers.ts`.
  - Reassignment workflows now return contract-appropriate `404/403/409/400` responses for invalid states in `lib/tasks/reassignment-requests.ts`.
  - Replan route pre-validates dependency references/cycles before writes and fails fast on unresolved mapping in `app/api/projects/[projectId]/replan/route.ts`.

## 2026-02-21T18:51:33Z

- Decision summary: Publish agent2 work as dependency-ordered stacked PRs (`PB-010 -> PB-011 -> PB-012 -> PB-013 -> PB-014`) and close each linked issue through PR completion flow.
- Rationale: Existing local history already isolates each task into sequential commits, so stacked PRs preserve deterministic progression and simplify review of dependent planner behavior.
- Alternatives considered:
  - Squash all agent2 work into one PR against `main`.
  - Open five independent PRs against `main` with duplicate overlapping diffs.
- Impact on files or behavior:
  - Branch and PR sequence now mirrors deterministic planning flow and task dependencies.
  - Issue closure is tied to PR completion with explicit issue links per task.

## 2026-02-21T18:54:12Z

- Decision summary: Close agent2 issues `#12`-`#16` immediately after opening their matching PRs and posting issue->PR linkage comments.
- Rationale: User requested closeout after PR completion in this overnight run; all required task deliverables were already implemented and pushed in branch/PR form.
- Alternatives considered:
  - Leave issues open until stacked PRs are merged to `main`.
  - Close only the lead issue and keep dependent issues open.
- Impact on files or behavior:
  - Issues `#12`, `#13`, `#14`, `#15`, and `#16` are now closed with traceable comments pointing to PRs `#34`-`#38`.


## 2026-02-21T21:08:31Z
- Decision: Represent dashboard countdowns as non-negative integer hours (`Math.ceil` then clamp at `0`) and map legacy project roles (`owner/member`) to API roles (`admin/user`) in read APIs.
- Rationale: Frontend dashboard and workflow views need deterministic countdown values and stable capability flags even while Agent 1 role migration remains in progress.
- Alternatives considered:
  - Return signed (negative) hours for overdue milestones.
  - Defer role normalization until `PB-018` closes.
- Impact:
  - `lib/dashboard/read-model.ts`
  - `lib/server/project-access.ts`
  - `API_CONTRACT.md`

## 2026-02-21T21:13:03Z
- Decision: Use deterministic dependency-aware task ordering (Kahn topological sort with due-date/created-at/id tie-breakers) for task detail timeline placement.
- Rationale: Task detail modal and timeline deep-link APIs need stable phase positioning across repeated reads, even when due dates collide or DAG edges are sparse.
- Alternatives considered:
  - Pure due-date sort without dependency graph awareness.
  - Randomized tie-breaking on equal due dates.
- Impact:
  - `lib/workflow/task-timeline-position.ts`
  - `app/api/projects/[projectId]/tasks/[taskId]/detail/route.ts`
  - `app/api/projects/[projectId]/workflow/timeline/[taskId]/route.ts`
  - `API_CONTRACT.md`
  - `DATAMODEL.md`

## 2026-02-21T21:16:19Z
- Decision: Expose workflow write capability flags (`canManageProject`, `canEditWorkflow`) directly in board/timeline aggregate responses based on normalized project role.
- Rationale: Frontend needs a single trusted source of role-aware affordances to avoid client-side drift and duplicate role-logic inference.
- Alternatives considered:
  - Infer capabilities in frontend only from raw role.
  - Return role only and leave write-gate matrix undocumented.
- Impact:
  - `lib/workflow/board-view.ts`
  - `lib/workflow/timeline-view.ts`
  - `app/api/projects/[projectId]/workflow/board/route.ts`
  - `app/api/projects/[projectId]/workflow/timeline/route.ts`
  - `API_CONTRACT.md`

## 2026-02-21T21:02:47Z - Normalize Project Roles to `admin|user` at API Boundary

- Decision summary:
  - Standardize all API DTOs and authorization checks on `admin | user`.
- Rationale:
  - UI and Phase 2 permissions are defined in `admin/user` terms, while some existing records/contracts still use `owner/member`. A normalization layer avoids breaking legacy rows while removing role-name drift.
- Alternatives considered:
  - Migrate all existing DB rows immediately to `admin/user`.
  - Continue exposing mixed `owner/member` and `admin/user` values in APIs.
- Impact on files or behavior:
  - Added role mapping/authorization utilities in `lib/auth/project-role.ts`.
  - Added canonical role types in `types/roles.ts`.
  - Updated role language in `API_CONTRACT.md` and `DATAMODEL.md`.
  - Permission guards can now consistently return `403` using normalized role semantics.
