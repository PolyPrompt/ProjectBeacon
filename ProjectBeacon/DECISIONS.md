## 2026-02-21T21:20:14Z
- decision: Implemented a local cookie-backed auth scaffold (`pb_user_id`, `pb_role`, `pb_last_project_id`) for protected post-onboarding UI routes instead of Clerk middleware.
- rationale: Blocking auth foundation issues (`PB-017`, `PB-018`) are still open, but `PB-024` requires immediate protected shell behavior and role badge/auth controls.
- alternatives considered: (1) wait for Clerk integration and block `PB-024`; (2) add full Clerk integration in `agent3` scope. Both were rejected due ownership boundaries and execution requirements.
- impact: Added `/sign-in`, `lib/auth/session.ts`, and `/projects/[projectId]` shell route protection with explicit scaffold behavior.
## 2026-02-21T21:27:02Z
- decision: Dashboard page (`PB-025`) uses contract-shaped scaffold data and partial-fetch tolerance when `/api/projects/:projectId/dashboard`, `/tasks/my`, or `/tasks/:taskId/detail` are unavailable.
- rationale: Dependency APIs (`PB-021`, `PB-022`) are still open/in handoff, but UI delivery for modal/deep-link/countdown flow is required now.
- alternatives considered: hard-fail dashboard render until all APIs are live; rejected because it blocks UI verification and role QA.
- impact: Added `lib/workspace/page-data.ts` with strict DTO normalization, scaffold notices, and task-detail modal fallback behavior.

## 2026-02-21T21:31:32Z
- decision: Implemented documents management UI with permissive response parsing (`signedUrl`/`url`/nested forms) and scaffold fallback documents when list/view endpoints fail.
- rationale: Document APIs (`PB-020`) are still open, but PB-026 requires preview/embed and role-aware controls now.
- alternatives considered: enforce a single strict response shape and hard-fail UI when not matched; rejected to preserve progress and end-to-end UX validation.
- impact: Added role-aware documents page + preview modal with explicit read-only user state and admin mutation controls that attempt contract endpoints.

## 2026-02-21T21:34:21Z
- decision: Settings page uses API-first mutations with graceful scaffold behavior for share/leave/update/delete while dependency endpoints (`PB-019`) are still open.
- rationale: `PB-027` requires complete role-aware UX flows now, including delete-confirmation safety and redirect behavior.
- alternatives considered: hide settings actions until backend fully ships; rejected because it blocks QA coverage of role-based post-onboarding paths.
- impact: Added role-aware settings component with explicit admin-only visibility, typed-delete confirmation (`DELETE`), and redirect-on-success behavior.

## 2026-02-21T21:37:35Z
- decision: Workflow pages (`PB-028`) use API capability flags when present and role-based fallback capability defaults when workflow endpoints are unavailable.
- rationale: `PB-023` dependency remains open/in-progress, but board/timeline UX and deep-link paths are required for post-onboarding completion.
- alternatives considered: hide workflow pages until APIs are done; rejected because it blocks end-to-end navigation and modal deep-link validation.
- impact: Added dedicated board/timeline pages with explicit view switch control, per-user board columns, timeline ordering, and selected-task highlight via query deep-link.

