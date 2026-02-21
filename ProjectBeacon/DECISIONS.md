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

