# Project Beacon Phase 2 Tasks

## Post-Onboarding Userflow + Role Permissions (`admin` and `user`)

## Execution Planner

## Critical Path (Longest Blocking Chain)
`PB-017 -> PB-018 -> PB-021 -> PB-022 -> PB-023 -> PB-025 -> PB-028 -> PB-029`

## Parallel Work Lanes

### Lane A: Auth + Roles + Project Controls (Agent 1)
- Wave 1: `PB-017`, `PB-018`
- Wave 2: `PB-019`
- Wave 3: `PB-020`

### Lane B: Workflow/Data APIs (Agent 2)
- Starts after role guards stabilize in `PB-018`.
- Wave 1: `PB-021`
- Wave 2: `PB-022`
- Wave 3: `PB-023`

### Lane C: App Shell + Pages (Agent 3)
- Can scaffold with mocks after `PB-017`, then bind to APIs as they land.
- Wave 1: `PB-024`
- Wave 2: `PB-025`, `PB-026`, `PB-027`
- Wave 3: `PB-028`, `PB-029`

## Start-Now Checklist (Minimize Idle Time)
- Agent 1: start `PB-017` immediately (Clerk integration + route protection).
- Agent 2: define DTOs and Zod schemas for dashboard/workflow read models while waiting for `PB-018`.
- Agent 3: scaffold persistent post-onboarding layout + 5-button navbar shell from existing project route tree.

## Coordination Milestones
- M4: `PB-018` done -> role checks (`admin` vs `user`) are frozen for all APIs/UI.
- M5: `PB-021` + `PB-022` done -> dashboard task table + task detail modal can switch from scaffold data to real APIs.
- M6: `PB-023` + `PB-020` done -> workflow board/timeline and documents retrieval/embed can run fully live.

## Whiteboard Assumptions (for Issue Filing)
- Navbar “5 buttons” is interpreted as: `Dashboard`, `Documents`, `Board`, `Timeline`, `Settings` (with board/timeline grouped as workflow pages).
- UI “soft deadline” maps to existing `tasks.due_at` from `DATAMODEL.md` (no duplicate date field introduced).
- “Next due milestone” is defined as the earliest non-`done` task by `tasks.due_at` (null due dates excluded from milestone selection).
- Task assignment explanation uses assignment metadata + required skills; API contract exposes it as `assignmentReasoning` for the task detail modal.
- Document access for `user` is assigned/read-only; `admin` manages upload/assignment.
- In this iteration (no replan flow), “documents used to generate tasks” means all project documents included in the generation input set.

## Domain A: Access, Auth, and Role Model

## TASK: Clerk Auth Foundation and Route Protection
### Task Metadata
- Task ID: `PB-017`
- Owner Role: `agent1` (Platform + Data)
- Depends On: `[]`

### Context
Main app currently has no Clerk integration in `package.json`, no auth middleware, and no protected project/API route guard.

### Goal
Implement Clerk in the main app and enforce authenticated access for post-onboarding routes and protected APIs.

### Acceptance Criteria
- [ ] Main app installs and configures `@clerk/nextjs`.
- [ ] `app/layout.tsx` is wrapped with `ClerkProvider`.
- [ ] Middleware protects `/projects/**` and `/api/**` (excluding explicitly public routes).
- [ ] Unauthenticated users are redirected to sign-in; APIs return `401`.
- [ ] Shared auth helper exists for route handlers/server components.

### Constraints
- Do not wire auth through the `clerk-nextjs/` sandbox app; integrate directly in main app.
- Keep all protected route behavior consistent across server and API layers.

### Files to create or edit
- CREATE: `/ProjectBeacon/middleware.ts`
- CREATE: `/ProjectBeacon/lib/auth/clerk-auth.ts`
- EDIT: `/ProjectBeacon/app/layout.tsx`
- EDIT: `/ProjectBeacon/package.json`
- EDIT: `/ProjectBeacon/.env.example`
- EDIT: `/ProjectBeacon/README.md`

### Expected output / interface
```ts
export type SessionUser = {
  clerkUserId: string;
  email: string | null;
  localUserId: string | null;
};
```

## TASK: Project Membership Roles (`admin` vs `user`) and Authorization Guards
### Task Metadata
- Task ID: `PB-018`
- Owner Role: `agent1` (Platform + Data)
- Depends On: [`PB-017`]

### Context
Current model/docs use `owner/member`; whiteboard requirements require `admin/user` behavior after onboarding.

### Goal
Finalize role semantics and enforce project-level authorization with creator as `admin`.

### Acceptance Criteria
- [ ] Project creator is persisted as `admin`.
- [ ] Joined members default to `user`.
- [ ] Role guard utility supports membership checks and minimum-role checks.
- [ ] APIs expose role in DTOs as `admin | user` (backward mapping allowed at DB layer).
- [ ] Permission failures return `403`.

### Constraints
- If DB keeps legacy values (`owner/member`), implement a stable mapping adapter instead of breaking existing rows.
- Update contracts/docs to avoid role-name drift.

### Files to create or edit
- CREATE: `/ProjectBeacon/lib/auth/project-role.ts`
- CREATE: `/ProjectBeacon/types/roles.ts`
- EDIT: `/ProjectBeacon/API_CONTRACT.md`
- EDIT: `/ProjectBeacon/DATAMODEL.md`
- EDIT: `/ProjectBeacon/DECISIONS.md`

### Expected output / interface
```ts
export type ProjectRole = "admin" | "user";
```

## TASK: Settings APIs (Share, Leave, Admin Project Management)
### Task Metadata
- Task ID: `PB-019`
- Owner Role: `agent1` (Platform + Data)
- Depends On: [`PB-018`]

### Context
Post-onboarding settings flow needs shared actions for all members and admin-only project controls.

### Goal
Implement backend settings actions:
- both roles: share project, leave project
- admin only: change project name, change deadline, delete project

### Acceptance Criteria
- [ ] Members can generate/use share actions from settings.
- [ ] Members can leave project (with guard against orphaning project admin state).
- [ ] Admin can update `name` and `deadline`.
- [ ] Admin can delete project with cascade-safe behavior.
- [ ] Non-admin receives `403` for admin-only actions.

### Constraints
- Prevent last-admin leave unless another admin exists or explicit transfer path is completed.
- Preserve deterministic error shapes from `API_CONTRACT.md`.

### Files to create or edit
- CREATE: `/ProjectBeacon/app/api/projects/[projectId]/settings/route.ts`
- CREATE: `/ProjectBeacon/app/api/projects/[projectId]/leave/route.ts`
- CREATE: `/ProjectBeacon/app/api/projects/[projectId]/share-link/route.ts`
- CREATE: `/ProjectBeacon/lib/projects/settings-policy.ts`
- EDIT: `/ProjectBeacon/API_CONTRACT.md`

### Expected output / interface
```ts
export type ProjectSettingsCapabilities = {
  canShare: boolean;
  canLeave: boolean;
  canEditProject: boolean;
  canDeleteProject: boolean;
};
```

## TASK: Documents Access, Planning-Source Listing, and Supabase Retrieval APIs
### Task Metadata
- Task ID: `PB-020`
- Owner Role: `agent1` (Platform + Data)
- Depends On: [`PB-018`, `PB-019`]

### Context
Whiteboard requires read-only/assigned document access for members and broader controls for admins.

### Goal
Add document APIs for role-aware listing, retrieval from Supabase file storage, and “used for planning” views.

### Acceptance Criteria
- [ ] Admin can upload/list/delete documents for a project.
- [ ] Admin can assign document visibility to specific members.
- [ ] Users can list/read only assigned (or explicitly public) documents.
- [ ] “Documents used to generate tasks” endpoint returns all project documents used in the generation step for this iteration (no replan history dimension).
- [ ] Document open action returns a short-lived signed URL for popup/embed preview from Supabase file store.
- [ ] Unauthorized document access returns `403`.

### Constraints
- Keep SQL metadata and object storage responsibilities separated.
- Do not expose raw storage keys to unauthorized users.
- Signed URL TTL must be short and non-cacheable.

### Files to create or edit
- CREATE: `/ProjectBeacon/app/api/projects/[projectId]/documents/route.ts`
- CREATE: `/ProjectBeacon/app/api/projects/[projectId]/documents/[documentId]/access/route.ts`
- CREATE: `/ProjectBeacon/app/api/projects/[projectId]/documents/[documentId]/view/route.ts`
- CREATE: `/ProjectBeacon/app/api/projects/[projectId]/documents/used-in-planning/route.ts`
- CREATE: `/ProjectBeacon/lib/documents/access-policy.ts`
- CREATE: `/ProjectBeacon/lib/documents/supabase-signed-url.ts`
- EDIT: `/ProjectBeacon/DATAMODEL.md`
- EDIT: `/ProjectBeacon/API_CONTRACT.md`

## Domain B: Dashboard + Workflow Data APIs

## TASK: Dashboard Summary + My Tasks APIs (Soft Deadline Sorted)
### Task Metadata
- Task ID: `PB-021`
- Owner Role: `agent2` (AI + Planning/Workflow)
- Depends On: [`PB-018`, `PB-012`]

### Context
Current UI shells use fallback data. Post-onboarding dashboard needs stable API-backed data for both roles.

### Goal
Provide dashboard-focused read endpoints for onboarded members, including soft-deadline sorting and milestone/deadline countdowns.

### Acceptance Criteria
- [ ] `GET /api/projects/:projectId/dashboard` returns next milestone + overall project deadline countdown.
- [ ] `GET /api/projects/:projectId/tasks/my` returns only current user tasks sorted by soft deadline (`tasks.due_at` ascending, nulls last).
- [ ] Dashboard payload computes “next milestone” as the earliest non-`done` task with non-null `due_at`.
- [ ] Endpoint returns team status summary (`todo/in_progress/blocked/done` breakdown).
- [ ] Non-members cannot read project dashboard data.

### Files to create or edit
- CREATE: `/ProjectBeacon/app/api/projects/[projectId]/dashboard/route.ts`
- CREATE: `/ProjectBeacon/app/api/projects/[projectId]/tasks/my/route.ts`
- CREATE: `/ProjectBeacon/lib/dashboard/read-model.ts`
- EDIT: `/ProjectBeacon/API_CONTRACT.md`

### Expected output / interface
```ts
export type DashboardSummaryDTO = {
  myTasks: Array<{
    id: string;
    title: string;
    description: string;
    status: "todo" | "in_progress" | "blocked" | "done";
    softDeadline: string | null;
    difficultyPoints: 1 | 2 | 3 | 5 | 8;
  }>;
  finalDeadlineCountdownHours: number;
  nextMilestoneCountdownHours: number | null;
  teamStatus: {
    todo: number;
    inProgress: number;
    blocked: number;
    done: number;
  };
};
```

## TASK: Task Detail Modal and Task-Specific Timeline APIs
### Task Metadata
- Task ID: `PB-022`
- Owner Role: `agent2` (AI + Planning/Workflow)
- Depends On: [`PB-021`]

### Context
Dashboard task rows open a modal that needs richer task data, assignment reasoning, and deep-link timeline context for the selected task.

### Goal
Implement detail APIs for task modal payload and task-specific timeline/dependency placement.

### Acceptance Criteria
- [ ] `GET /api/projects/:projectId/tasks/:taskId/detail` returns title, description, soft deadline, dependencies, and assignment reasoning.
- [ ] `GET /api/projects/:projectId/workflow/timeline/:taskId` returns task phase position (`beginning|middle|end`) and dependency timing context.
- [ ] Detail payload includes deep-link URL to the timeline view for that specific task.
- [ ] Endpoints enforce membership and project scope.

### Files to create or edit
- CREATE: `/ProjectBeacon/app/api/projects/[projectId]/tasks/[taskId]/detail/route.ts`
- CREATE: `/ProjectBeacon/app/api/projects/[projectId]/workflow/timeline/[taskId]/route.ts`
- CREATE: `/ProjectBeacon/lib/tasks/assignment-reasoning.ts`
- CREATE: `/ProjectBeacon/lib/workflow/task-timeline-position.ts`
- EDIT: `/ProjectBeacon/DATAMODEL.md`
- EDIT: `/ProjectBeacon/API_CONTRACT.md`

### Expected output / interface
```ts
export type TaskDetailModalDTO = {
  id: string;
  title: string;
  description: string;
  softDeadline: string | null;
  assignmentReasoning: string;
  dependencyTaskIds: string[];
  timelineTaskUrl: string;
  timelinePlacement: {
    phase: "beginning" | "middle" | "end";
    sequenceIndex: number;
    totalTasks: number;
  };
};
```

## TASK: Workflow Board and Timeline Aggregate APIs
### Task Metadata
- Task ID: `PB-023`
- Owner Role: `agent2` (AI + Planning/Workflow)
- Depends On: [`PB-021`, `PB-022`]

### Context
Workflow tabs require two holistic project views:
- board: all users across the top with their task columns
- timeline: project process order with dependency links

### Goal
Implement board/timeline aggregate endpoints that back the dedicated workflow pages.

### Acceptance Criteria
- [ ] `GET /api/projects/:projectId/workflow/board` returns assignee-based columns (one column per project member with their tasks).
- [ ] `GET /api/projects/:projectId/workflow/timeline` returns ordered task flow with dependency edges and due-date placement.
- [ ] Timeline payload exposes whether a task is early/mid/late project-phase to support “beginning or end” indicators.
- [ ] Response includes role-based capability flags so frontend can enforce read/write affordances safely.
- [ ] Endpoints enforce membership and project scope.

### Files to create or edit
- CREATE: `/ProjectBeacon/app/api/projects/[projectId]/workflow/board/route.ts`
- CREATE: `/ProjectBeacon/app/api/projects/[projectId]/workflow/timeline/route.ts`
- CREATE: `/ProjectBeacon/lib/workflow/board-view.ts`
- CREATE: `/ProjectBeacon/lib/workflow/timeline-view.ts`
- EDIT: `/ProjectBeacon/API_CONTRACT.md`

## Domain C: Post-Onboarding Frontend Experience

## TASK: Authenticated Post-Onboarding App Shell + 5-Button Navbar
### Task Metadata
- Task ID: `PB-024`
- Owner Role: `agent3` (Dashboard + UX)
- Depends On: [`PB-017`, `PB-018`, `PB-015`]

### Context
Current pages are workflow-first and do not yet provide the required role-aware post-onboarding navigation shell.

### Goal
Create a shared app shell for onboarded members with exactly five main nav buttons.

### Acceptance Criteria
- [ ] Navbar includes: `Dashboard`, `Documents`, `Board`, `Timeline`, `Settings`.
- [ ] Active-state styling and route transitions are consistent across all pages.
- [ ] Layout includes role badge (`admin` or `user`) and auth controls.
- [ ] Unauthenticated access redirects to sign-in.
- [ ] Mobile and desktop navigation are both supported.

### Files to create or edit
- CREATE: `/ProjectBeacon/components/navigation/project-nav-shell.tsx`
- EDIT: `/ProjectBeacon/app/projects/[projectId]/page.tsx`
- EDIT: `/ProjectBeacon/app/projects/[projectId]/workspace/page.tsx`
- EDIT: `/ProjectBeacon/README.md`

## TASK: Dashboard Page (My Tasks + Countdowns + Team Status)
### Task Metadata
- Task ID: `PB-025`
- Owner Role: `agent3` (Dashboard + UX)
- Depends On: [`PB-021`, `PB-022`, `PB-024`]

### Context
Whiteboard dashboard includes task list, milestone/final countdowns, and team status summary.

### Goal
Implement the post-onboarding dashboard page with interactive task-detail modal backed by dashboard/task-detail APIs.

### Acceptance Criteria
- [ ] Dashboard shows next due milestone and overall project deadline countdown.
- [ ] “My Tasks” table shows current user tasks sorted by soft deadline.
- [ ] Clicking a task opens a popup/modal with soft deadline, description, assignment reasoning, and dependency summary.
- [ ] Modal includes a direct link to that task’s timeline view.
- [ ] Final submission and next milestone countdown cards render correctly.
- [ ] Team status overview and mini-board snapshot are shown.
- [ ] Loading/empty/error states are handled.

### Files to create or edit
- EDIT: `/ProjectBeacon/components/dashboard/project-dashboard-shell.tsx`
- CREATE: `/ProjectBeacon/components/dashboard/my-tasks-panel.tsx`
- CREATE: `/ProjectBeacon/components/dashboard/task-detail-modal.tsx`
- CREATE: `/ProjectBeacon/components/dashboard/team-status-overview.tsx`
- EDIT: `/ProjectBeacon/lib/workspace/page-data.ts`

## TASK: Documents Page (Admin Manage, User Read-Only Assigned)
### Task Metadata
- Task ID: `PB-026`
- Owner Role: `agent3` (Dashboard + UX)
- Depends On: [`PB-020`, `PB-024`]

### Context
Documents currently live in workflow upload UI; post-onboarding requires a dedicated documents area with role-aware controls.

### Goal
Build a standalone documents page for ongoing project collaboration with file preview/embed from Supabase storage.

### Acceptance Criteria
- [ ] Admin can upload/remove/assign docs from the documents page.
- [ ] User can view/download assigned docs but cannot mutate.
- [ ] Documents page includes section for “used to generate tasks.”
- [ ] Clicking a document opens popup/embed using signed URL retrieval endpoint.
- [ ] UI clearly labels read-only access for non-admins.
- [ ] Page handles empty/loading/error states.

### Files to create or edit
- CREATE: `/ProjectBeacon/app/projects/[projectId]/documents/page.tsx`
- CREATE: `/ProjectBeacon/components/documents/project-documents-page.tsx`
- CREATE: `/ProjectBeacon/components/documents/document-preview-modal.tsx`
- EDIT: `/ProjectBeacon/components/navigation/project-nav-shell.tsx`

## TASK: Settings Page (Share, Leave, and Admin Project Controls)
### Task Metadata
- Task ID: `PB-027`
- Owner Role: `agent3` (Dashboard + UX)
- Depends On: [`PB-019`, `PB-024`]

### Context
Settings requirements differ by role: both roles can share/leave; admin gets project-edit and delete controls.

### Goal
Implement role-aware settings UX with safe destructive flows.

### Acceptance Criteria
- [ ] `user` can share project and leave project.
- [ ] `admin` can also change name/deadline and delete project.
- [ ] Admin-only controls are hidden/disabled for non-admins.
- [ ] Delete flow uses explicit confirmation and redirect behavior.

### Files to create or edit
- CREATE: `/ProjectBeacon/app/projects/[projectId]/settings/page.tsx`
- CREATE: `/ProjectBeacon/components/settings/project-settings-page.tsx`
- EDIT: `/ProjectBeacon/components/navigation/project-nav-shell.tsx`

## TASK: Workflow Pages (Board + Timeline) in Navbar Flow
### Task Metadata
- Task ID: `PB-028`
- Owner Role: `agent3` (Dashboard + UX)
- Depends On: [`PB-023`, `PB-024`, `PB-025`]

### Context
Board/timeline currently exist as planning-step pages; post-onboarding needs dedicated workflow pages from navbar.

### Goal
Create persistent workflow pages (`Board`, `Timeline`) for active project execution.

### Acceptance Criteria
- [ ] Workflow area includes explicit `Timeline <-> Board` view switch control.
- [ ] Board page renders one column per user with that user’s tasks.
- [ ] Timeline page renders ordered execution view with due dates, phase position, and dependency links.
- [ ] Timeline supports deep-link opening for a selected task from dashboard modal links.
- [ ] Capability flags from API determine edit affordances by role.
- [ ] Workflow pages are reachable from navbar in one click.

### Files to create or edit
- CREATE: `/ProjectBeacon/app/projects/[projectId]/board/page.tsx`
- CREATE: `/ProjectBeacon/app/projects/[projectId]/timeline/page.tsx`
- CREATE: `/ProjectBeacon/components/workflow/board-page.tsx`
- CREATE: `/ProjectBeacon/components/workflow/timeline-page.tsx`

## TASK: End-to-End Role QA Matrix and Handoff Signoff
### Task Metadata
- Task ID: `PB-029`
- Owner Role: `agent3` (Dashboard + UX Integration)
- Depends On: [`PB-025`, `PB-026`, `PB-027`, `PB-028`]

### Context
Role-specific UX/security behavior must be validated across all post-onboarding pages before rollout.

### Goal
Run final role-path QA and publish integration handoff artifacts.

### Acceptance Criteria
- [ ] QA matrix covers `admin` and `user` paths for all 5 nav pages.
- [ ] Dashboard task-modal path is verified (`my tasks row -> modal -> timeline deep-link`).
- [ ] Documents preview/embed path is verified against signed URL retrieval from Supabase.
- [ ] Settings/document/workflow permission checks are verified end-to-end.
- [ ] `HANDOFF.md` and `DECISIONS.md` include final behavior notes and known gaps.
- [ ] Regression list is attached with actionable follow-ups.

### Files to create or edit
- EDIT: `/ProjectBeacon/HANDOFF.md`
- EDIT: `/ProjectBeacon/DECISIONS.md`
- CREATE: `/ProjectBeacon/docs/qa/post-onboarding-role-matrix.md`
