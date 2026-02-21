# MVP Design Document (V0, Web App)

## 1. Document Control

- Product / App Name: `Project Beacon` (Group Project Task Delegator)

- Doc Owner: Product + Engineering Team

- Contributors: Agent1/Agent2/Agent3 planning inputs (`tasks.md`, `tasks2.md`, `API_CONTRACT.md`, `DATAMODEL.md`)

- Last Updated: 2026-02-21

- Status: Draft

- Links:

- Repo: `https://github.com/PolyPrompt/ProjectBeacon`

- API contract: `API_CONTRACT.md`

- Data model: `DATAMODEL.md`

- Task plans: `tasks.md`, `tasks2.md`

- Current open V0 issues: `#39`-`#51`

## 2. Executive Summary

- One-liner:

Build a web app that helps college CS student teams delegate project work fairly by turning project requirements into skill-aware tasks, dependencies, and timelines.

- MVP goal:

Deliver an end-to-end flow where an admin can create a project, add members/context/docs, generate and assign tasks, and each user can track/execute their own work in dashboard + workflow views.

- Success looks like:

Within 5 minutes, a signed-in admin can create a project, add skills/context/documents, run AI clarification + task generation, lock and assign tasks, and team members can immediately see their tasks and deadlines.

## 3. Problem Statement

- What problem are we solving?

CS group projects are often delegated informally, causing uneven workload, unclear dependencies, late handoffs, and poor accountability.

- Current pain points:

- Unclear skill visibility across teammates.

- One or two students overloaded with hard tasks.

- Dependency order not explicit.

- Missed deadlines due to weak timeline visibility.

- Difficulty enforcing accountability.

- Who has this problem?

Student teams in CS courses with multi-person deliverables.

- Primary audience:

College students collaborating on technical group projects.

- Secondary audience (optional):

None in V0.

- Why now?

Hackathon timeline + existing repo foundation already supports core AI planning pipeline and dashboard/workflow API contracts.

## 4. Objectives and Non-Objectives

- Objectives (what we will do):

- Deliver role-aware project collaboration for `admin` and `user`.

- Support project setup, member management, skills, docs, AI clarification, task generation, and assignment.

- Provide post-assignment execution UX: dashboard, settings, documents, workflow (board/timeline).

- Persist all core entities in Supabase-backed data model.

- Non-Objectives (explicitly out of scope for MVP):

- Professor-facing portal.

- Replan flow and task swap/handoff flow.

- Dark mode toggle.

- Timely/calendar integration and notification automation.

- Resume parsing for automatic skill extraction.

## 5. Assumptions and Constraints

- Assumptions:

- Teams are CS-focused (V0 specialization).

- Users can manually enter skills.

- Project creator is admin; invited members default to user.

- AI clarification threshold is 85%, max 5 questions.

- Difficulty scale is planning-poker style (`1,2,3,5,8`).

- Data availability assumptions:

- Supabase Postgres + object storage configured.

- OpenAI API key available for planning endpoints.

- Auth identity is available (currently header-based in server utilities; Clerk integration planned/finalized by V0 auth tasks).

- Constraints:

- Timeline: hackathon MVP.

- Team: 3 implementation agents + QA/runner automation + Task manager + ui workflow tester.

- Tech constraints:

- Next.js App Router (route handlers).

- TypeScript.

- Supabase REST + storage metadata model.

- Zod validation at API boundaries (per contract rules).

- Compliance / legal / privacy:

- Store only required student profile/project data.

- No professor-side analytics in V0.

## 6. Target Users and Key Use Cases

- Persona A:

- Role / context: CS student team member in a multi-week group project.

- Goals: Know exactly what to do, by when, and how work depends on others.

- Pain points: Unclear ownership, late teammates, unclear task quality bar.

- Device + environment: Desktop-first web usage (laptop in school/home).

- Persona B:

- Role / context: Project creator / team lead (admin).

- Goals: Set project baseline, generate fair assignments, monitor progress.

- Pain points: Manually distributing work fairly is hard and time-consuming.

- Primary Use Cases (MVP):

- UC1: Admin creates project, sets deadline/details, invites members, and imports/adds skills.

- UC2: Admin uploads documents + answers clarifying questions, generates draft tasks, then locks and assigns.

- UC3: Users view dashboard tasks + timelines, update task status/details, and track dependencies.

- Edge / Secondary Use Cases (document, likely not MVP):

- Email notifications for upcoming deadlines.

## 7. User Journey

- Happy Path (MVP):

1. User signs in.

2. Admin creates project and shares invite link.

3. Members join and add/import skills.

4. Admin adds context/docs.

5. AI asks clarifying questions until ready (`>=85%` confidence or max 5 with assumptions).

6. AI generates task graph (tasks + required skills + dependencies).

7. Admin reviews/edits, then locks and runs assignment.

8. Users see assigned tasks in dashboard and workflow views; progress statuses are updated.

- Alternative / Failure Paths:

- If unauthenticated: return `401` or redirect to sign-in.

- If non-member/non-admin action: return `403`.

- If validation fails: return `422`-style validation error (contract error envelope).

- If DB/upstream fails: return stable `INTERNAL_ERROR`/`UPSTREAM_DB_ERROR`.

## 8. Scope: MVP Features

- F1: Authentication + membership

- Description: Sign-in, user bootstrap, project membership checks.

- User value: Secure project access with role-based behavior.

- Acceptance criteria:

- Given unauthenticated requests, protected routes return `401`.

- Given non-members, project resources return `403`.

- Given valid membership, project APIs return scoped data.

- Priority: Must

- F2: Project setup + sharing

- Description: Create/update project, add members, generate share link.

- User value: Fast team formation and setup.

- Acceptance criteria:

- Admin can create project with name/description/deadline.

- Admin can share project access link.

- Members can join and appear in project roster.

- Priority: Must

- F3: Skills management

- Description: User profile skills + project skill overrides/import.

- User value: Better assignment fit.

- Acceptance criteria:

- User can add/update skills.

- Project can import profile skills.

- Effective skills are resolved with project override first.

- Priority: Must

- F4: Context + documents + AI clarification

- Description: Add context and documents, run clarification loop.

- User value: Better requirement understanding before task generation.

- Acceptance criteria:

- Clarification loop enforces threshold `85` and max `5` questions.

- Document metadata is stored; files are retrieved via storage-backed links.

- Priority: Must

- F5: AI task generation + assignment lifecycle

- Description: Generate task graph, lock plan, assign tasks.

- User value: Fair, structured delegation at speed.

- Acceptance criteria:

- Generation returns tasks + skills + dependencies.

- Planning status follows `draft -> locked -> assigned`.

- Priority: Must

- F6: Post-onboarding execution UX

- Description: Navbar and pages for dashboard, settings, documents, workflow.

- User value: Clear execution and monitoring surface.

- Acceptance criteria:

- Dashboard shows next milestone, deadline countdown, my tasks.

- Workflow supports board and timeline views with dependency context.

- Settings are role-aware (admin vs user).

- Priority: Must

- Deferred Features (Post-MVP Backlog):

- Professor portal and peer review.

- Task swap/handoff.

- Replan flow.

- Notifications/time scheduling integrations.

- Dark mode / light mode toggle
- Group meeting scheduler

## 9. UX / UI Design

- Information Architecture

- Main navigation items (V0): `/dashboard`, `/settings`, `/documents`, `/workflow` (workflow contains board + timeline views).

- Pages / routes (target V0 surface):

- `/`

- `/login` (or auth provider sign-in route)

- `/projects/[projectId]/dashboard` (or project root dashboard)

- `/projects/[projectId]/settings`

- `/projects/[projectId]/documents`

- `/projects/[projectId]/workflow` with board/timeline modes

- Key Screens:

- Screen 1: Admin project setup + planning workspace.

- Screen 2: User dashboard with task modal.

- Screen 3: Workflow board/timeline view.

- Interaction Notes:

- Loading states: skeletons/spinners for async fetches.

- Empty states: explicit “no tasks/docs yet”.

- Error states: stable API error envelope surfaced in UI.

- Confirmation patterns: modals for destructive actions (leave/delete), save confirmations for edits.

- Form validation behavior: schema-driven validation + actionable field errors.

- Accessibility Baseline:

- Keyboard navigation and visible focus states.

- Sufficient color contrast.

- ARIA labels for modals/dynamic panels.

- Screen-reader labels for task actions/status controls.

## 10. Data Model (High Level)

- Entities (from `DATAMODEL.md`):

- `users` (`id`, `name`, `email`, `created_at`)

- `projects` (`id`, `name`, `description`, `deadline`, `owner_user_id`, `planning_status`, `created_at`, `updated_at`)

- `project_members` (`project_id`, `user_id`, `role`)

- `skills`

- `user_skills`

- `project_member_skills`

- `tasks` (`status`, `difficulty_points`, `assignee_user_id`, `due_at`)

- `task_required_skills`

- `task_dependencies`

- `project_contexts`

- `project_documents`

- Relationships:

- User 1—N owned projects.

- Users N—N projects via `project_members`.

- Project 1—N tasks / contexts / documents.

- Tasks N—N skills via `task_required_skills`.

- Tasks self-graph via `task_dependencies`.

- Retention / deletion behavior (MVP baseline):

- Store only project-collaboration data needed for delegation/execution.

- File bytes live in object storage; SQL stores metadata.

- Project deletion behavior must be cascade-safe (admin-only action).

## 11. System Design (MVP Architecture)

- Frontend:

- Framework: Next.js (App Router) + React + TypeScript.

- State: server-first fetch + client state for interactions/modals.

- Styling: Tailwind CSS v4.

- Routing: file-based routes under `app/`.

- Validation: request validation in route handlers (contract requires Zod).

- Auth handling on client: auth provider integration (Clerk planned); current backend helpers accept authenticated user headers.

- Backend:

- API style: REST route handlers under `app/api`.

- Framework: Next.js server runtime.

- Core services:

- Auth gate (`lib/server/auth.ts`)

- Membership/role checks (`lib/server/project-access.ts`)

- Error contract (`lib/server/errors.ts`)

- Supabase REST data access (`lib/server/supabase-rest.ts`)

- Authorization:

- Project membership required for project-scoped endpoints.

- Role capability flags returned for workflow actions.

- Storage:

- Database: Supabase Postgres (accessed via REST).

- File storage: Supabase storage (document metadata in `project_documents`).

- Caching: `no-store` on key reads for consistency.

- Third-party integrations:

- Auth provider: Clerk (env keys present).

- AI: OpenAI (`OPENAI_API_KEY`, `OPENAI_MODEL`).

- Email: `RESEND_API_KEY` available for invite/email extensions.

## 12. API Design (MVP Endpoints)

- Auth / identity:

- `POST /api/users/bootstrap`

- Projects and members:

- `POST /api/projects`

- `GET /api/projects/:projectId`

- `PATCH /api/projects/:projectId`

- `GET /api/projects/:projectId/members`

- `POST /api/projects/:projectId/members`

- V0 settings/share (planned in Phase 2 tasks):

- `POST /api/projects/:projectId/share-link`

- `POST /api/projects/:projectId/leave`

- `PATCH /api/projects/:projectId/settings` (admin updates project metadata; delete action policy)

- Skills:

- `GET /api/me/skills`

- `POST /api/me/skills`

- `GET /api/projects/:projectId/skills`

- `POST /api/projects/:projectId/skills/import-profile`

- Documents/context/planning:

- `POST /api/projects/:projectId/documents`

- `POST /api/projects/:projectId/context/confidence`

- `POST /api/projects/:projectId/context/clarify`

- `POST /api/projects/:projectId/context/clarify-response`

- `POST /api/projects/:projectId/ai/generate-tasks`

- `POST /api/projects/:projectId/planning/lock`

- `POST /api/projects/:projectId/assignments/run`

- Dashboard/workflow execution:

- `GET /api/projects/:projectId/dashboard`

- `GET /api/projects/:projectId/tasks/my`

- `GET /api/projects/:projectId/tasks/:taskId/detail`

- `GET /api/projects/:projectId/workflow/board`

- `GET /api/projects/:projectId/workflow/timeline`

- `GET /api/projects/:projectId/workflow/timeline/:taskId`

- Error codes:

- `401` unauthenticated

- `403` forbidden/membership/role failure

- `404` not found

- `422` validation error

- `500` internal error

- Canonical error envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",

    "message": "Human readable message",

    "details": {}
  }
}
```

## 13. Security and Privacy

- Authentication method:

- MVP contract assumes authenticated identity for protected routes.

- Current server helper extracts user ID from trusted auth headers (`x-user-id`, `x-projectbeacon-user-id`, `x-clerk-user-id`).

- Authorization model:

- Project-level membership checks on all project resources.

- Role-based capabilities (`admin` vs `user`) for management/edit actions.

- Sensitive data stored:

- User identity fields, project data, documents metadata, skill profile data.

- No raw credential storage in app DB.

- Encryption:

- HTTPS in transit.

- Supabase-managed encryption at rest.

- Audit logging:

- Minimal in MVP; extend for admin-sensitive actions post-MVP.

- Privacy implications:

- User-entered project data and task performance metadata must remain project-scoped.

- No professor analytics in V0 to reduce data exposure scope.

## 14. Performance and Reliability

- Expected load (MVP):

- DAU estimate: 50-500 students.

- Peak requests/minute: 100-500 during class/project spikes.

- Largest payloads: document metadata lists, timeline graph payloads.

- Performance targets:

- TTI: <3s on standard campus/home broadband.

- API p95 latency: <500ms for non-AI reads.

- AI endpoint latency: best-effort, async-friendly UX states.

- Error rate: <1% on core read APIs.

- Reliability:

- Retries/backoff for external AI/storage failures.

- Graceful degradation:

- Keep existing data visible when generation/clarification fails.

- Show deterministic API errors in UI.

## 15. Observability and Analytics

- Logging:

- API error logs, auth failures, permission failures, planning transitions.

- Redact PII in logs where not required.

- Metrics:

- API latency and failure counts.

- Clarification completion rate.

- Generate->lock->assign funnel conversion.

- Product analytics events (MVP):

- `sign_up_started`

- `sign_up_completed`

- `project_created`

- `skills_updated`

- `clarification_completed`

- `tasks_generated`

- `planning_locked`

- `assignments_run`

- `dashboard_viewed`

- `task_status_updated`

- `error_shown`

## 16. QA Strategy

- Test coverage (MVP):

- Unit tests for read-model transformations and role capability logic.

- Integration tests for route handlers + error envelopes.

- E2E smoke path: create project -> generate -> assign -> user dashboard/workflow visibility.

- Manual checklist:

- Auth failures return `401`.

- Non-member access returns `403`.

- Clarification threshold logic works (`85` or max `5`).

- Dashboard countdowns and task sorting are correct.

- Workflow board/timeline reflect dependencies.

- Settings/documents role guards enforced.

- Browsers/devices:

- Chrome, Safari, Firefox, Edge (desktop).

- Mobile responsive sanity for core pages.

## 17. Rollout Plan

- Environments:

- `dev`, `staging`, `production`.

- Beta group:

- Small student teams from CS classes.

- Feature gating:

- Gate admin-only settings actions and any unfinished write endpoints.

- Launch checklist:

- Env vars configured (`SUPABASE`, `OPENAI`, auth keys).

- Error monitoring enabled.

- DB backups enabled.

- Role checks verified in staging.

## 18. Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |

|---|---|---|---|

| AI assigns unfairly due to incomplete skill data | High | Medium | Require manual skill entry/import before assignment; allow admin review/edit before lock/assign |

| Hallucinated/low-quality task breakdown | High | Medium | Clarification loop (`85%`, max 5), explicit admin review gate before assignment |

| Dependency graph errors create blocked execution | Medium | Medium | Dependency validation and deterministic ordering in workflow read models |

| Unauthorized project data access | High | Low-Medium | Membership checks on all project APIs; role capability gating |

| Over-reliance on one student despite AI support | Medium | Medium | Difficulty balancing + visibility in board/timeline; admin review before assign |

| Poor adoption due to UI friction | Medium | Medium | Keep V0 flow short: setup -> generate -> assign -> execute dashboard |

## 19. Open Questions

- Should V0 nav ship as 4 top-level items (`Dashboard`, `Settings`, `Documents`, `Workflow`) with board/timeline inside workflow, or as separate board/timeline nav entries?

- Is invite email sending a hard MVP requirement, or is share-link copy + manual send sufficient for demo?

- Do we include task title/description edit persistence in V0 backend contracts now, or keep read-focused execution APIs and finalize write contracts next sprint?

## 20. Appendix

- Glossary:

- `Admin`: project creator/manager role.

- `User`: project member role.

- `Soft deadline`: task-level `due_at`.

- `Next milestone`: earliest non-done task with non-null due date.

- References:

- `API_CONTRACT.md`

- `DATAMODEL.md`

- `tasks.md`

- `tasks2.md`

- `README.md`

- Decision log:

- `DECISIONS.md` for timeline ordering, role normalization, and capability response design.

## MVP Cut Line Checklist

- Must be true for MVP:

- Users can complete the core job end-to-end.

- Auth and membership checks work.

- Errors/empty/loading states are designed.

- Data persists in Supabase.

- Core analytics/logging events exist.

- Basic role-based security checks exist.

- Nice-to-have (cut first):

- Professor portal.

- Replan/swap workflows.

- Notification scheduling and dark mode.
