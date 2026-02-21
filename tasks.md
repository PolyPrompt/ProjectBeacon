# Project Beacon MVP Tasks

## Execution Planner

## Critical Path (Longest Blocking Chain)
`PB-001 -> PB-002 -> PB-003 -> PB-004 -> PB-008 -> PB-010 -> PB-011 -> PB-012 -> PB-015 -> PB-016`

## Parallel Work Lanes

### Lane A: Foundation/Data (Agent 1)
- Wave 1: `PB-001`, `PB-002`, `PB-003`, `PB-004`
- Wave 2 (parallel after PB-004): `PB-005`, `PB-007`, `PB-009`
- Wave 3: `PB-006`, `PB-008`

### Lane B: AI/Planning (Agent 2)
- Starts after schema + core project tables stabilize.
- Wave 1: `PB-010`
- Wave 2: `PB-011`
- Wave 3: `PB-012`, then `PB-013` and `PB-014` in parallel

### Lane C: Dashboard/UX (Agent 3)
- Can scaffold early with mocks.
- Wave 1: Start `PB-015` shell with mocked data.
- Wave 2: Integrate `PB-015` with live APIs as `PB-004/PB-005/PB-007/PB-011` land.
- Wave 3: `PB-016` after `PB-009/PB-010/PB-011/PB-012` are available.

## Start-Now Checklist (Minimize Idle Time)
- Agent 1: start `PB-001` immediately.
- Agent 2: prep Zod schemas + prompt templates while waiting for `PB-002/PB-004/PB-008`.
- Agent 3: scaffold dashboard/workspace UI states with mock contracts from `API_CONTRACT.md`.

## Coordination Milestones
- M1: `PB-002` done -> Agent 2 can begin backend AI routes against real schema.
- M2: `PB-011` done -> Agent 3 can bind draft task board and dependency preview.
- M3: `PB-012` done -> Agent 3 can enable lock/assign controls in workspace UI.

## Domain A: Platform Foundation (Auth + DB + Services)

## TASK: MVP Service Clients and Env Contracts
### Task Metadata
- Task ID: `PB-001`
- Owner Role: `agent1` (Platform + Data)
- Depends On: `[]`

### Context
The app currently has a minimal Next.js scaffold in `/ProjectBeacon/ProjectBeacon/app` with no shared backend service clients. Upcoming features require Clerk auth, Supabase DB/storage, and OpenAI access from route handlers and server actions.

### Goal
Create a single typed foundation for environment validation and reusable server-side clients for Clerk, Supabase, and OpenAI.

### Acceptance Criteria
- [ ] A typed env parser exists and fails fast on missing required variables for Clerk, Supabase, and OpenAI.
- [ ] Shared server client helpers exist and are imported by API routes instead of duplicating setup logic.
- [ ] Unauthorized requests can be consistently rejected through one auth guard utility.

### Constraints
- Do not modify `/ProjectBeacon/ProjectBeacon/DATAMODEL.md` in this task.
- Use Next.js App Router route handlers + TypeScript + Zod for validation.
- Output must match this type/interface:

```ts
export type AppEnv = {
  NEXT_PUBLIC_APP_URL: string;
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: string;
  CLERK_SECRET_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_STORAGE_BUCKET: string;
  OPENAI_API_KEY: string;
};
```

### Files to create or edit
- CREATE: `/ProjectBeacon/ProjectBeacon/lib/env.ts`
- CREATE: `/ProjectBeacon/ProjectBeacon/lib/auth/require-user.ts`
- CREATE: `/ProjectBeacon/ProjectBeacon/lib/supabase/server.ts`
- CREATE: `/ProjectBeacon/ProjectBeacon/lib/openai/client.ts`
- EDIT: `/ProjectBeacon/ProjectBeacon/package.json` — add required SDK dependencies

### Expected output / interface
A small shared service layer that route handlers can import as:

```ts
const user = await requireUser();
const supabase = getServiceSupabaseClient();
const openai = getOpenAIClient();
```

## TASK: MVP Database Schema and Storage Setup
### Task Metadata
- Task ID: `PB-002`
- Owner Role: `agent1` (Platform + Data)
- Depends On: [`PB-001`]

### Context
`/ProjectBeacon/ProjectBeacon/DATAMODEL.md` defines target entities, but no migration files exist yet. Strict MVP needs project creation, sharing, skills, context/documents, and AI-generated tasks with dependencies.

### Goal
Create the initial Supabase SQL migration for all strict-MVP tables, indexes, and constraints, including storage metadata support.

### Acceptance Criteria
- [ ] Migration creates users, projects, project_members, skills, user_skills, project_member_skills, tasks, task_required_skills, task_dependencies, project_contexts, project_documents, and task_reassignment_requests.
- [ ] Schema includes task fields needed by current MVP flow (`difficulty_points`, `due_at`, `assignee_user_id`, `status`) and project planning status (`draft|locked|assigned`).
- [ ] Schema includes `project_contexts.context_type` (`initial|clarification_qa|assumption|document_extract`) for deterministic prompt assembly.
- [ ] Constraints prevent invalid dependency links, duplicate membership/skill joins, and invalid swap/handoff request shapes.

### Constraints
- Do not modify application UI files in `/ProjectBeacon/ProjectBeacon/app` in this task.
- Use Supabase SQL migrations with snake_case columns, UUID PKs, and `timestamptz` UTC timestamps.
- Output must match this type/interface:

```ts
export type TaskRow = {
  id: string;
  project_id: string;
  assignee_user_id: string | null;
  title: string;
  description: string;
  difficulty_points: 1 | 2 | 3 | 5 | 8;
  status: "todo" | "in_progress" | "blocked" | "done";
  due_at: string | null;
  created_at: string;
  updated_at: string;
};
```

### Files to create or edit
- CREATE: `/ProjectBeacon/ProjectBeacon/supabase/migrations/20260221_000001_mvp_schema.sql`
- CREATE: `/ProjectBeacon/ProjectBeacon/types/db.ts`
- EDIT: `/ProjectBeacon/ProjectBeacon/DATAMODEL.md` — align model doc to implemented strict MVP schema

### Expected output / interface
A reproducible migration that can be run on a fresh Supabase project and produce MVP-ready relational tables + storage metadata support.

## TASK: Clerk User Bootstrap and Sync
### Task Metadata
- Task ID: `PB-003`
- Owner Role: `agent1` (Platform + Data)
- Depends On: [`PB-001`, `PB-002`]

### Context
Clerk is the only auth system for MVP, and Supabase is only DB/storage. Routes need an internal `users` row keyed to Clerk user identity for ownership, membership, and assignee references.

### Goal
Ensure each authenticated Clerk user is mirrored in the `users` table on first app load and kept updated for name/email.

### Acceptance Criteria
- [ ] Visiting the app while signed in creates a `users` row if missing.
- [ ] Name/email updates from Clerk are reflected in the local `users` row.
- [ ] Duplicate user rows are prevented by unique Clerk identifier or email constraint.

### Constraints
- Do not use Supabase Auth.
- Use Clerk server helpers and idempotent upsert logic in backend.
- Output must match this type/interface:

```ts
export type UserBootstrapResult = {
  userId: string;
  clerkUserId: string;
  email: string;
  created: boolean;
};
```

### Files to create or edit
- CREATE: `/ProjectBeacon/ProjectBeacon/app/api/users/bootstrap/route.ts`
- CREATE: `/ProjectBeacon/ProjectBeacon/lib/users/upsert-user.ts`
- EDIT: `/ProjectBeacon/ProjectBeacon/app/layout.tsx` — call bootstrap path in authenticated app shell

### Expected output / interface
A backend endpoint that always returns one stable local user identity per Clerk user and can be safely called repeatedly.

## Domain B: Project Lifecycle (Create + Share + Join)

## TASK: Create Project and Add Project Details Flow
### Task Metadata
- Task ID: `PB-004`
- Owner Role: `agent1` (Platform + Data)
- Depends On: [`PB-001`, `PB-002`, `PB-003`]

### Context
There is no existing project CRUD. MVP requires users to create projects and store core details such as title, description, and deadline.

### Goal
Implement authenticated create/read/update APIs and a minimal UI form for project creation and detail editing.

### Acceptance Criteria
- [ ] Owner can create a project with `name`, `description`, and `deadline`.
- [ ] Creator is automatically inserted into `project_members` with owner role.
- [ ] Invalid deadlines (past dates) are rejected with clear validation errors.

### Constraints
- Do not implement non-MVP project analytics in this task.
- Use route handlers with Zod request validation and Supabase service client writes.
- Output must match this type/interface:

```ts
export type ProjectPayload = {
  id: string;
  name: string;
  description: string;
  deadline: string;
  ownerUserId: string;
  planningStatus: "draft" | "locked" | "assigned";
};
```

### Files to create or edit
- CREATE: `/ProjectBeacon/ProjectBeacon/app/api/projects/route.ts`
- CREATE: `/ProjectBeacon/ProjectBeacon/app/projects/new/page.tsx`
- CREATE: `/ProjectBeacon/ProjectBeacon/components/projects/project-form.tsx`
- EDIT: `/ProjectBeacon/ProjectBeacon/app/page.tsx` — route signed-in users to project creation/dashboard entry point

### Expected output / interface
Project create API response:

```json
{
  "id": "p_123",
  "name": "CS Capstone",
  "description": "Team project details",
  "deadline": "2026-03-20T00:00:00.000Z",
  "ownerUserId": "uuid",
  "planningStatus": "draft"
}
```

## TASK: Share Link Generation and Immediate Join
### Task Metadata
- Task ID: `PB-005`
- Owner Role: `agent1` (Platform + Data)
- Depends On: [`PB-001`, `PB-002`, `PB-004`]

### Context
MVP sharing requires a generated project URL and immediate membership on open. Current code has no invite/link model or join flow.

### Goal
Add secure project join link creation and a join endpoint/page that adds the viewer as a project member immediately.

### Acceptance Criteria
- [ ] Owner/member can generate a share link token for a project.
- [ ] Opening a valid link while authenticated adds user to `project_members` and redirects to project dashboard.
- [ ] Re-opening link for an existing member is idempotent (no duplicate membership rows).

### Constraints
- Do not add approval queues for join requests.
- Use a signed join token (stateless or DB-backed implementation allowed) with expiration and one route handler for join action.
- Output must match this type/interface:

```ts
export type ProjectJoinLink = {
  projectId: string;
  token: string;
  expiresAt: string;
  joinUrl: string;
};
```

### Files to create or edit
- CREATE: `/ProjectBeacon/ProjectBeacon/app/api/projects/[projectId]/share-link/route.ts`
- CREATE: `/ProjectBeacon/ProjectBeacon/app/join/[token]/page.tsx`
- CREATE: `/ProjectBeacon/ProjectBeacon/app/api/join/[token]/route.ts`
- EDIT: `/ProjectBeacon/ProjectBeacon/components/projects/project-form.tsx` — surface share action for created projects

### Expected output / interface
Join success payload:

```json
{
  "projectId": "p_123",
  "userId": "uuid",
  "joined": true,
  "alreadyMember": false
}
```

## TASK: Share via Email with Project URL
### Task Metadata
- Task ID: `PB-006`
- Owner Role: `agent1` (Platform + Data)
- Depends On: [`PB-001`, `PB-005`]

### Context
MVP requires adding emails and sending the share URL directly. No email dispatch API currently exists.

### Goal
Implement email invite sending endpoint that accepts recipients and sends project join URL.

### Acceptance Criteria
- [ ] User can submit one or more valid email addresses from the share UI.
- [ ] Each valid recipient receives an email containing the project join URL.
- [ ] Invalid email entries are reported without blocking valid sends.

### Constraints
- Do not add complex email template engine in MVP.
- Use a simple provider client (Resend) behind one route handler and basic rate limiting.
- Output must match this type/interface:

```ts
export type SendShareEmailResponse = {
  projectId: string;
  sent: Array<{ email: string; status: "sent" }>;
  failed: Array<{ email: string; reason: string }>;
};
```

### Files to create or edit
- CREATE: `/ProjectBeacon/ProjectBeacon/lib/email/send-project-share.ts`
- CREATE: `/ProjectBeacon/ProjectBeacon/app/api/projects/[projectId]/share-email/route.ts`
- CREATE: `/ProjectBeacon/ProjectBeacon/components/projects/share-email-form.tsx`
- EDIT: `/ProjectBeacon/ProjectBeacon/package.json` — add email SDK dependency

### Expected output / interface
Input payload:

```json
{
  "projectId": "p_123",
  "emails": ["teammate1@school.edu", "teammate2@school.edu"],
  "joinUrl": "https://projectbeacon.app/join/abc123"
}
```

## Domain C: Skills + Documentation

## TASK: Profile Skills CRUD
### Task Metadata
- Task ID: `PB-007`
- Owner Role: `agent1` (Platform + Data)
- Depends On: [`PB-001`, `PB-002`, `PB-003`]

### Context
MVP requires users to maintain a reusable skill profile; current app has no skills UI or API.

### Goal
Implement CRUD for user profile skills backed by `skills` and `user_skills` tables.

### Acceptance Criteria
- [ ] Signed-in users can add, update level, and remove profile skills.
- [ ] Adding the same skill twice updates existing row instead of duplicating.
- [ ] Skill level validation enforces allowed range.

### Constraints
- Do not include resume parsing in MVP.
- Use normalized skills tables (`skills` + `user_skills`) with upsert semantics.
- Output must match this type/interface:

```ts
export type UserSkillDTO = {
  id: string;
  skillId: string;
  skillName: string;
  level: number;
};
```

### Files to create or edit
- CREATE: `/ProjectBeacon/ProjectBeacon/app/api/me/skills/route.ts`
- CREATE: `/ProjectBeacon/ProjectBeacon/app/profile/page.tsx`
- CREATE: `/ProjectBeacon/ProjectBeacon/components/profile/skills-editor.tsx`
- EDIT: `/ProjectBeacon/ProjectBeacon/app/layout.tsx` — include authenticated nav link to profile

### Expected output / interface
`GET /api/me/skills` response:

```json
{
  "skills": [
    {
      "id": "us_001",
      "skillId": "s_react",
      "skillName": "React",
      "level": 4
    }
  ]
}
```

## TASK: Project Skills from Profile + Custom Skills
### Task Metadata
- Task ID: `PB-008`
- Owner Role: `agent1` (Platform + Data)
- Depends On: [`PB-002`, `PB-004`, `PB-007`]

### Context
MVP explicitly requires project skill selection from both existing profile skills and new project-specific custom skills.

### Goal
Create project skill management endpoints/UI that merge profile skills with custom additions and persist effective project member skills.

### Acceptance Criteria
- [ ] User can import their profile skills into project scope in one action.
- [ ] User can add custom project-specific skills not already in profile.
- [ ] Assignment prep reads effective project skills using project override first, then profile fallback.

### Constraints
- Do not collapse skill data into JSON arrays in the project row.
- Use `skills`, `user_skills`, and `project_member_skills` relational tables.
- Output must match this type/interface:

```ts
export type EffectiveProjectSkill = {
  userId: string;
  skillId: string;
  skillName: string;
  level: number;
  source: "project_override" | "profile";
};
```

### Files to create or edit
- CREATE: `/ProjectBeacon/ProjectBeacon/app/api/projects/[projectId]/skills/import-profile/route.ts`
- CREATE: `/ProjectBeacon/ProjectBeacon/app/api/projects/[projectId]/skills/route.ts`
- CREATE: `/ProjectBeacon/ProjectBeacon/components/projects/project-skills-editor.tsx`
- EDIT: `/ProjectBeacon/ProjectBeacon/app/projects/[projectId]/page.tsx` — include project skill editor section

### Expected output / interface
`GET /api/projects/:projectId/skills` response:

```json
{
  "skills": [
    {
      "userId": "uuid",
      "skillId": "s_react",
      "skillName": "React",
      "level": 4,
      "source": "project_override"
    }
  ]
}
```

## TASK: Project Documentation Upload to Supabase Storage
### Task Metadata
- Task ID: `PB-009`
- Owner Role: `agent1` (Platform + Data)
- Depends On: [`PB-001`, `PB-002`, `PB-004`]

### Context
MVP needs project documentation upload and storage. The data model already separates storage metadata (`project_documents`) from text context (`project_contexts`).

### Goal
Implement file upload flow using Supabase Storage plus metadata persistence and listing APIs.

### Acceptance Criteria
- [ ] Authenticated project members can upload allowed document types and metadata is saved in `project_documents`.
- [ ] Uploaded files are stored in Supabase Storage under a deterministic project-scoped path.
- [ ] Oversized or disallowed MIME files are rejected with actionable errors.

### Constraints
- Do not store raw file bytes in SQL tables.
- Use signed upload URLs or server upload with Supabase Storage SDK.
- Output must match this type/interface:

```ts
export type ProjectDocumentDTO = {
  id: string;
  projectId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  uploadedByUserId: string;
  createdAt: string;
};
```

### Files to create or edit
- CREATE: `/ProjectBeacon/ProjectBeacon/app/api/projects/[projectId]/documents/route.ts`
- CREATE: `/ProjectBeacon/ProjectBeacon/components/projects/project-documents-uploader.tsx`
- CREATE: `/ProjectBeacon/ProjectBeacon/lib/storage/upload-project-document.ts`
- EDIT: `/ProjectBeacon/ProjectBeacon/app/projects/[projectId]/page.tsx` — add project documentation section

### Expected output / interface
Upload response:

```json
{
  "document": {
    "id": "doc_123",
    "projectId": "p_123",
    "fileName": "requirements.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 482193,
    "storageKey": "projects/p_123/docs/doc_123-requirements.pdf",
    "uploadedByUserId": "uuid",
    "createdAt": "2026-02-21T00:00:00.000Z"
  }
}
```

## Domain D: AI Planning Pipeline

## TASK: Clarifying Questions Pre-Planning Flow
### Task Metadata
- Task ID: `PB-010`
- Owner Role: `agent2` (AI + Planning Pipeline)
- Depends On: [`PB-001`, `PB-002`, `PB-004`, `PB-008`, `PB-009`]

### Context
MVP requires AI to ask follow-up questions before generation until confidence threshold is reached. Existing app has no context confidence or Q/A loop.

### Goal
Implement a pre-planning API flow that computes confidence, asks up to 5 clarifying questions, and stores Q/A context.

### Acceptance Criteria
- [ ] Endpoint returns confidence score and questions when context confidence is below 85%.
- [ ] Each answer is persisted to `project_contexts` and confidence is recomputed.
- [ ] Flow stops after max 5 questions and records explicit assumptions if still below threshold.

### Constraints
- Do not generate final tasks in this ticket.
- Use OpenAI structured output with Zod schema validation for confidence + questions.
- Output must match this type/interface:

```ts
export type ClarificationState = {
  confidence: number;
  threshold: number;
  askedCount: number;
  maxQuestions: number;
  questions: string[];
  assumptions?: string[];
  readyForGeneration: boolean;
};
```

### Files to create or edit
- CREATE: `/ProjectBeacon/ProjectBeacon/app/api/projects/[projectId]/context/clarify/route.ts`
- CREATE: `/ProjectBeacon/ProjectBeacon/app/api/projects/[projectId]/context/clarify-response/route.ts`
- CREATE: `/ProjectBeacon/ProjectBeacon/lib/ai/context-confidence.ts`
- CREATE: `/ProjectBeacon/ProjectBeacon/components/projects/clarification-panel.tsx`

### Expected output / interface
Clarify response shape:

```json
{
  "confidence": 72,
  "threshold": 85,
  "askedCount": 2,
  "maxQuestions": 5,
  "questions": [
    "What are the required deliverables?",
    "Which technologies are mandatory?"
  ],
  "readyForGeneration": false
}
```

## TASK: AI Draft Task Generation and Persistence
### Task Metadata
- Task ID: `PB-011`
- Owner Role: `agent2` (AI + Planning Pipeline)
- Depends On: [`PB-002`, `PB-004`, `PB-008`, `PB-010`]

### Context
MVP requires AI-generated tasks with difficulty, dependencies, and skill links, then persisting into SQL tables as a draft board for team review before assignment.

### Goal
Build the generation endpoint that consumes project context + skills and writes draft rows to `tasks`, `task_required_skills`, and `task_dependencies`.

### Acceptance Criteria
- [ ] Endpoint generates 6-12 tasks and persists rows with DB-generated IDs/timestamps.
- [ ] Persisted tasks include `difficulty_points`, `status`, `due_at`, with `assignee_user_id` left null during draft planning.
- [ ] Dependency persistence rejects invalid or cyclic edges before write.
- [ ] Project remains in `planning_status=draft` after generation.

### Constraints
- Do not let the model generate DB IDs or timestamps; DB is source of truth.
- Use OpenAI structured JSON output + server-side transformation and validation before insert.
- Output must match this type/interface:

```ts
export type AIGenerationResult = {
  tasks: Array<{
    id: string;
    projectId: string;
    assigneeUserId: string | null;
    title: string;
    description: string;
    difficultyPoints: 1 | 2 | 3 | 5 | 8;
    status: "todo" | "in_progress" | "blocked" | "done";
    dueAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  taskSkills: Array<{
    id: string;
    taskId: string;
    skillId: string;
    weight: number;
    createdAt: string;
  }>;
  taskDependencies: Array<{
    id: string;
    taskId: string;
    dependsOnTaskId: string;
  }>;
};
```

### Files to create or edit
- CREATE: `/ProjectBeacon/ProjectBeacon/app/api/projects/[projectId]/ai/generate-tasks/route.ts`
- CREATE: `/ProjectBeacon/ProjectBeacon/lib/ai/generate-task-plan.ts`
- CREATE: `/ProjectBeacon/ProjectBeacon/lib/tasks/validate-dependency-graph.ts`
- CREATE: `/ProjectBeacon/ProjectBeacon/types/ai-output.ts`

### Expected output / interface
Server-persisted response format (DB-populated IDs/timestamps):

```json
{
  "tasks": [
    {
      "id": "t_123",
      "projectId": "p_123",
      "assigneeUserId": null,
      "title": "Build Auth Middleware",
      "description": "Implement protected route checks",
      "difficultyPoints": 3,
      "status": "todo",
      "dueAt": "2026-03-01T00:00:00.000Z",
      "createdAt": "2026-02-21T00:00:00.000Z",
      "updatedAt": "2026-02-21T00:00:00.000Z"
    }
  ],
  "taskSkills": [
    {
      "id": "ts_001",
      "taskId": "t_123",
      "skillId": "s_react",
      "weight": 0.8,
      "createdAt": "2026-02-21T00:00:00.000Z"
    }
  ],
  "taskDependencies": [
    {
      "id": "td_001",
      "taskId": "t_123",
      "dependsOnTaskId": "t_001"
    }
  ]
}
```

## TASK: Planning Lock and Final Assignment Run
### Task Metadata
- Task ID: `PB-012`
- Owner Role: `agent2` (AI + Planning Pipeline)
- Depends On: [`PB-008`, `PB-011`]

### Context
The current product flow requires assignment only after humans review/edit generated tasks and lock the plan.

### Goal
Implement lock + final assignment endpoints that enforce `draft -> locked -> assigned`.

### Acceptance Criteria
- [ ] `POST /projects/:projectId/planning/lock` validates plan readiness and sets `planning_status=locked`.
- [ ] `POST /projects/:projectId/assignments/run` assigns only eligible project members and sets `planning_status=assigned`.
- [ ] Assignment run uses project skills override first, then profile fallback.

### Files to create or edit
- CREATE: `/ProjectBeacon/ProjectBeacon/app/api/projects/[projectId]/planning/lock/route.ts`
- CREATE: `/ProjectBeacon/ProjectBeacon/app/api/projects/[projectId]/assignments/run/route.ts`
- CREATE: `/ProjectBeacon/ProjectBeacon/lib/assignment/assign-tasks.ts`

## TASK: Replan with Stability and Fairness
### Task Metadata
- Task ID: `PB-013`
- Owner Role: `agent2` (AI + Planning Pipeline)
- Depends On: [`PB-011`, `PB-012`]

### Context
Replanning should preserve project continuity: avoid disrupting active work and keep assignments mostly stable.

### Goal
Implement replan endpoint with safeguards from `DATAMODEL.md`.

### Acceptance Criteria
- [ ] `POST /projects/:projectId/replan` updates tasks, skills, and dependencies with cycle validation.
- [ ] Completed tasks are unchanged; `in_progress` tasks stay with current assignees unless explicitly approved.
- [ ] New/updated `todo` tasks are assigned with fairness bias to avoid overloading high-workload members.

### Files to create or edit
- CREATE: `/ProjectBeacon/ProjectBeacon/app/api/projects/[projectId]/replan/route.ts`
- CREATE: `/ProjectBeacon/ProjectBeacon/lib/assignment/replan-policy.ts`

## TASK: Consent-Based Task Swap and Handoff
### Task Metadata
- Task ID: `PB-014`
- Owner Role: `agent2` (AI + Planning Pipeline)
- Depends On: [`PB-002`, `PB-004`, `PB-012`]

### Context
Teammates need controlled task swaps or one-way handoffs with explicit acceptance.

### Goal
Implement `task_reassignment_requests` workflow and assignment updates on acceptance.

### Acceptance Criteria
- [ ] Create swap/handoff request with reason and `pending` status.
- [ ] Counterparty can accept/reject; only accepted requests modify `tasks.assignee_user_id`.
- [ ] Validation enforces same-project users/tasks and proper swap vs handoff shape.

### Files to create or edit
- CREATE: `/ProjectBeacon/ProjectBeacon/app/api/projects/[projectId]/task-reassignment-requests/route.ts`
- CREATE: `/ProjectBeacon/ProjectBeacon/app/api/task-reassignment-requests/[requestId]/respond/route.ts`
- CREATE: `/ProjectBeacon/ProjectBeacon/lib/tasks/reassignment-requests.ts`

## Domain E: MVP Dashboard Experience

## TASK: Project Dashboard Shell
### Task Metadata
- Task ID: `PB-015`
- Owner Role: `agent3` (Dashboard + UX Integration)
- Depends On: [`PB-004`, `PB-005`, `PB-007`, `PB-011`]

### Context
You want a basic but not final dashboard that shows project summary, members, tasks, and dependency preview. Current app has no project detail dashboard page.

### Goal
Build a functional project dashboard shell page that aggregates and renders core project state from backend endpoints.

### Acceptance Criteria
- [ ] Dashboard displays project summary (`name`, `description`, `deadline`, planning status).
- [ ] Dashboard renders members list, task list, and dependency preview section.
- [ ] Empty states are handled for projects with no tasks or dependencies yet.

### Constraints
- Do not implement final visual polish or design-system-level styling in this ticket.
- Use server components for initial load with client components only where interactivity is needed.
- Output must match this type/interface:

```ts
export type ProjectDashboardViewModel = {
  project: {
    id: string;
    name: string;
    description: string;
    deadline: string;
    planningStatus: "draft" | "locked" | "assigned";
  };
  members: Array<{ userId: string; name: string; email: string; role: "owner" | "member" }>;
  tasks: Array<{ id: string; title: string; status: string; assigneeUserId: string | null; difficultyPoints: 1 | 2 | 3 | 5 | 8 }>;
  dependencyEdges: Array<{ taskId: string; dependsOnTaskId: string }>;
};
```

### Files to create or edit
- CREATE: `/ProjectBeacon/ProjectBeacon/app/projects/[projectId]/page.tsx`
- CREATE: `/ProjectBeacon/ProjectBeacon/components/dashboard/project-summary-card.tsx`
- CREATE: `/ProjectBeacon/ProjectBeacon/components/dashboard/project-members-list.tsx`
- CREATE: `/ProjectBeacon/ProjectBeacon/components/dashboard/project-task-list.tsx`
- CREATE: `/ProjectBeacon/ProjectBeacon/components/dashboard/dependency-preview.tsx`
- EDIT: `/ProjectBeacon/ProjectBeacon/app/page.tsx` — route authenticated users to recent project/dashboard

### Expected output / interface
UI description:
- Top summary panel with project metadata and share button.
- Members panel showing owner/member roster.
- Task panel showing title, assignee, status, and difficulty points.
- Dependency preview panel listing `Task A -> Task B` edges.

## TASK: Project Workspace Intake Section
### Task Metadata
- Task ID: `PB-016`
- Owner Role: `agent3` (Dashboard + UX Integration)
- Depends On: [`PB-009`, `PB-010`, `PB-011`, `PB-012`, `PB-015`]

### Context
MVP requires users to add project details, upload documentation, and run clarifying questions before task generation from one workspace entry point.

### Goal
Create a workspace section in the project dashboard that chains details, docs, clarify flow, and generation action in one guided sequence.

### Acceptance Criteria
- [ ] Workspace section allows adding/updating requirement text context entries.
- [ ] Users can upload docs, answer clarifying questions, then trigger generation from the same page.
- [ ] Generate action remains disabled until minimum required context is present.

### Constraints
- Do not add non-MVP timeline calendar views in this ticket.
- Use existing APIs from other tickets; do not duplicate backend logic inside UI components.
- Output must match this type/interface:

```ts
export type PlanningWorkspaceState = {
  contexts: Array<{ id: string; title: string | null; contextType: string; createdAt: string }>;
  documents: Array<{ id: string; fileName: string; createdAt: string }>;
  clarification: {
    confidence: number;
    readyForGeneration: boolean;
    askedCount: number;
    maxQuestions: number;
  };
  canGenerate: boolean;
};
```

### Files to create or edit
- CREATE: `/ProjectBeacon/ProjectBeacon/components/projects/planning-workspace.tsx`
- CREATE: `/ProjectBeacon/ProjectBeacon/components/projects/context-editor.tsx`
- EDIT: `/ProjectBeacon/ProjectBeacon/app/projects/[projectId]/page.tsx` — include planning workspace
- EDIT: `/ProjectBeacon/ProjectBeacon/components/projects/clarification-panel.tsx` — add submit/answer flow hooks

### Expected output / interface
A single dashboard workspace section with this action sequence:
1. Add or edit project context text.
2. Upload supporting documents.
3. Run clarify step and answer follow-up questions.
4. Trigger draft task generation once `canGenerate` is true.
5. Review/edit tasks, then lock plan and run final assignment.
