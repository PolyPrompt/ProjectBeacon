# Data Model (MVP)

This document defines the current **MVP data model** for Project Beacon so multiple agents can build against the same source of truth.

## Scope

- Focused on the current MVP schema.
- Supports: users, projects, members, skills, task assignment, required skills, dependencies, and project context documents.
- Does not include non-MVP tables yet (notifications, invites, AI run logs, comments, peer review, etc).

## Design Principles

- Keep the model relational and explicit (join tables over array blobs).
- Use project-specific skill overrides without duplicating all global skills.
- Keep task dependencies first-class for timeline and blocking logic.
- Prefer simple statuses and constraints for hackathon speed.

## Tables

## 1) `users`

Purpose: identity and top-level user account.

Fields:

- `id` (PK)
- `name`
- `email` (UNIQUE)
- `created_at`

## 2) `projects`

Purpose: project container and deadline.

Fields:

- `id` (PK)
- `name`
- `description`
- `deadline`
- `owner_user_id` (FK -> `users.id`)
- `planning_status` (`draft` | `locked` | `assigned`)
- `created_at`
- `updated_at`

Defaults/Policy:

- `planning_status` defaults to `draft` on project creation.

## 3) `project_members`

Purpose: membership join table between users and projects.

Fields:

- `id` (PK)
- `project_id` (FK -> `projects.id`)
- `user_id` (FK -> `users.id`)
- `role` (`owner` | `member`)

Constraints:

- UNIQUE (`project_id`, `user_id`)

## 4) `skills`

Purpose: canonical skill dictionary.

Fields:

- `id` (PK)
- `name` (UNIQUE)

## 5) `user_skills`

Purpose: global user skill profile (applies across projects).

Fields:

- `id` (PK)
- `user_id` (FK -> `users.id`)
- `skill_id` (FK -> `skills.id`)
- `level` (1-5)

Constraints:

- UNIQUE (`user_id`, `skill_id`)

## 6) `project_member_skills`

Purpose: project-specific override for a member's skill level.

Fields:

- `id` (PK)
- `project_id` (FK -> `projects.id`)
- `user_id` (FK -> `users.id`)
- `skill_id` (FK -> `skills.id`)
- `level` (1-5)

Constraints:

- UNIQUE (`project_id`, `user_id`, `skill_id`)

Usage rule:

- Assignment logic should use `project_member_skills` first; if missing, fall back to `user_skills`.

## 7) `tasks`

Purpose: atomic work items in a project.

Fields:

- `id` (PK)
- `project_id` (FK -> `projects.id`)
- `title`
- `description`
- `status` (`todo` | `in_progress` | `blocked` | `done`)
- `difficulty_points` (planning-poker style: 1, 2, 3, 5, 8)
- `assignee_user_id` (FK -> `users.id`, nullable)
- `due_at` (nullable)
- `created_at`
- `updated_at`

Constraints/Policy:

- `assignee_user_id` should reference a user that is a member of the same project (enforced in API/service layer).

## 8) `task_required_skills`

Purpose: required skills for a task.

Fields:

- `id` (PK)
- `task_id` (FK -> `tasks.id`)
- `skill_id` (FK -> `skills.id`)
- `weight` (optional, 1-5)

Constraints:

- UNIQUE (`task_id`, `skill_id`)

## 9) `task_dependencies`

Purpose: dependency graph between tasks.

Fields:

- `id` (PK)
- `task_id` (FK -> `tasks.id`)
- `depends_on_task_id` (FK -> `tasks.id`)

Constraints:

- UNIQUE (`task_id`, `depends_on_task_id`)
- CHECK (`task_id` != `depends_on_task_id`)

MVP dependency semantics:

- Treat all links as **finish-to-start**.

## 10) `project_contexts`

Purpose: stores assignment/project context content used for planning (manual text input or extracted document text).

Fields:

- `id` (PK)
- `project_id` (FK -> `projects.id`)
- `source_type` (`text` | `pdf` | `doc`)
- `context_type` (`initial` | `clarification_qa` | `assumption` | `document_extract`)
- `title` (nullable)
- `text_content` (long text)
- `status` (`active` | `archived`)
- `created_by_user_id` (FK -> `users.id`)
- `created_at`
- `updated_at`

Notes:

- Users can create context at project creation time or later.
- Large raw file binaries are not stored here; only text context and metadata.
- Use `context_type` to keep prompt assembly deterministic and avoid mixing assumptions with source requirements.

## 11) `project_documents`

Purpose: stores metadata for uploaded project files stored in object storage (for example S3).

Fields:

- `id` (PK)
- `project_id` (FK -> `projects.id`)
- `storage_key` (UNIQUE, object storage path/key)
- `file_name`
- `mime_type`
- `size_bytes`
- `uploaded_by_user_id` (FK -> `users.id`)
- `created_at`

Notes:

- File bytes live in object storage, not SQL.
- Enforce upload limits in API layer (for example max file count and max file size).

## 12) `task_reassignment_requests`

Purpose: consent-based task swap/transfer workflow between teammates.

Fields:

- `id` (PK)
- `project_id` (FK -> `projects.id`)
- `request_type` (`swap` | `handoff`)
- `task_id` (FK -> `tasks.id`) # primary task being moved
- `counterparty_task_id` (FK -> `tasks.id`, nullable) # required for `swap`, null for `handoff`
- `from_user_id` (FK -> `users.id`)
- `to_user_id` (FK -> `users.id`)
- `reason` (short text)
- `status` (`pending` | `accepted` | `rejected` | `cancelled`)
- `requested_by_user_id` (FK -> `users.id`)
- `responded_by_user_id` (FK -> `users.id`, nullable)
- `created_at`
- `responded_at` (nullable)

Notes:

- Reassignment only executes when request is accepted.
- Keep request history for accountability and conflict resolution.
- For `request_type=swap`, `counterparty_task_id` is required.
- For `request_type=handoff`, `counterparty_task_id` must be null.

## Relationship Summary

- One `user` can own many `projects`.
- `users` <-> `projects` is many-to-many through `project_members`.
- `users` <-> `skills` is many-to-many through `user_skills`.
- `project_members` can have project-specific skill overrides via `project_member_skills`.
- One `project` has many `tasks`.
- One `project` can have many `project_contexts`.
- One `project` can have many `project_documents`.
- One `project` can have many `task_reassignment_requests`.
- `tasks` <-> `skills` is many-to-many through `task_required_skills`.
- `tasks` can depend on other `tasks` through `task_dependencies`.

## Core Data Flow

This section describes the end-to-end flow from project creation through execution and re-planning.

### Flow 1: Identity and Skill Baseline

Input:

- User signs in and opens app.

Reads:

- `users` by auth identity/email.
- `user_skills` for baseline capabilities.

Writes:

- If first login, create `users` row with core identity fields (`name`, `email`).
- If user updates account/profile basics (for MVP: name/email where allowed), update `users`.
- If user adds/edits profile skills, write `user_skills`.

Output:

- App has both account identity context (`users`) and a global skill baseline (`user_skills`) before any project context exists.

### Flow 2: Project Creation and Team Formation

Input:

- Owner creates project with `name`, `description`, and `deadline`.
- Owner adds teammates.
- Owner may optionally add project context immediately (text and/or documents) or defer it.

Writes:

- `projects` insert with `owner_user_id`.
- `project_members` insert for owner (`role=owner`).
- `project_members` inserts for teammates (`role=member`).

Validation:

- Enforce UNIQUE (`project_id`, `user_id`) to prevent duplicate members.
- Only owner/member can query project internals.

Output:

- A project container exists with a concrete team roster.
- Optional initial context can already be available for planning.

### Flow 2.5: Context and Document Ingestion

Input:

- User submits assignment details as text and/or uploads one or more files (for example PDF).

Writes:

- Insert text context rows into `project_contexts`.
- Insert file metadata rows into `project_documents` after successful object-storage upload.

Storage pattern:

- Upload flow should use presigned URLs (client -> object storage).
- Backend stores only metadata (`project_documents`) and any extracted/manual text (`project_contexts`).

Validation:

- Enforce allowed MIME types.
- Enforce max file size and max files per project.

Output:

- Project has durable context sources available for AI/manual task planning.

### Flow 3: Project-Specific Skill Calibration

Input:

- Team updates member strengths for this specific project (optional).
- Users can select global skills to copy into project scope and add project-specific skills directly.

Reads:

- Existing `user_skills` baseline.

Writes:

- `project_member_skills` for overrides (for example, same skill but lower/higher level for this project context).

Decision Rule:

- Effective skill for assignment = project override (`project_member_skills`) if present, otherwise global (`user_skills`).

Output:

- Assignment logic now reflects real context, not just static profile data.

### Flow 3.5: Context Confidence and Clarification Loop (Pre-Planning Gate)

Goal:

- Ensure the model has enough project context before generating tasks.

Input:

- Current project context from `project_contexts` (manual text + extracted document text).

Reads:

- Active context rows in `project_contexts`.
- Current team/skill context from `project_members`, `project_member_skills`, and fallback `user_skills`.

Process:

- Backend sends normalized context to AI to compute a confidence score (0-100%).
- If confidence is below threshold (recommended MVP threshold: 85%), AI generates follow-up questions.
- Ask up to 5 clarification questions total.
- After each answer, backend recomputes confidence.
- If confidence still remains below threshold after 5 questions, proceed with explicit assumptions.

Writes:

- Store each clarification exchange (question + answer) as additional `project_contexts` text entries (for traceability).
- Store final assumption block as a `project_contexts` text entry when fallback is used.

Validation/Policy:

- Max clarification questions: 5.
- Recompute confidence after every new answer.
- Never block forever; continue to planning with assumptions after limit is reached.

Output:

- Planning stage receives either:
  - sufficiently confident context, or
  - context + explicit assumptions if threshold was not met.

Data model note:

- MVP does not use separate question/answer tables; clarification history is persisted in `project_contexts`.

### Flow 4: Task Plan Creation

Input:

- Project requirements after confidence gate passes or assumption fallback completes.

Writes:

- `tasks` rows with title, description, difficulty points, due date, status (`todo` initially), and `assignee_user_id` left null during planning.
- `projects.planning_status` remains `draft`.

Output:

- Structured draft task set exists for human review before assignment.

### Flow 5: Skill-to-Task Linking

Input:

- For each task, define required skills (and optional weight).

Writes:

- `task_required_skills` rows per task.

Validation:

- UNIQUE (`task_id`, `skill_id`) to prevent duplicate skill entries on the same task.

Output:

- Backend can explain assignment decisions and support reassignment when membership changes.

### Flow 6: Dependency Graph Construction

Input:

- Team or AI specifies ordering constraints between tasks (AI first and team can edit).

Writes:

- `task_dependencies` edges (`task_id` depends on `depends_on_task_id`).

Validation:

- CHECK `task_id != depends_on_task_id`.
- Treat all dependencies as finish-to-start in MVP.
- Reject dependency cycles at API/service layer before persisting changes.

Operational Meaning:

- A task should be marked blocked in app logic when one of its dependencies is not done.
- Timeline ordering can be derived from this graph.

Output:

- Task execution order is explicit and machine-readable.

### Flow 6.5: Human Review and Plan Lock

Input:

- Team reviews AI-generated board and manually edits tasks.
- Team can add/remove tasks, update required skills, and adjust dependencies.

Writes:

- `tasks` updates/inserts/deletes.
- `task_required_skills` updates/inserts/deletes.
- `task_dependencies` updates/inserts/deletes.

Validation:

- Plan can only be locked if each task has a valid title/status and no invalid dependency edges.
- Recommended lock preconditions: at least one task exists and all dependency links are cycle-free.

Lock action:

- Set `projects.planning_status` from `draft` -> `locked`.

Output:

- Final task plan is frozen for assignment run.

### Flow 6.6: Final Assignment Run

Input:

- Project is in `planning_status=locked`.

Reads:

- `tasks` (unassigned tasks).
- `task_required_skills`.
- `project_members`.
- `project_member_skills` + fallback `user_skills`.

Writes:

- Set `tasks.assignee_user_id` based on assignment scoring.
- Set `projects.planning_status` from `locked` -> `assigned`.

Assignment Heuristic (MVP-friendly):

- Filter eligible members (must belong to project).
- Score each member by skill match against required skills.
- Apply workload balancing (avoid repeatedly selecting the most skilled person).

Output:

- Final assignments are published to users.

### Flow 7: Daily Execution Loop

Input:

- Users view board/timeline and update tasks.

Reads:

- `tasks` scoped by `project_id`.
- `task_dependencies` to determine blocked/unblocked state.
- `task_required_skills` for task details and assignment reasoning.
- `project_members` for assignee display and ownership checks.

Writes:

- `tasks.status` transitions (`todo` -> `in_progress` -> `done`, or `blocked`).
- `tasks.assignee_user_id` changes only through accepted reassignment requests (or owner/admin override endpoint if added).
- `tasks.updated_at` on all edits.

Validation:

- Assignee must be a member of the same project.
- Status changes respect dependency state (recommended policy: cannot move to `in_progress` if blocked).

Output:

- Real-time project state remains consistent with skill fit and dependency constraints.

### Flow 7.5: Consent-Based Task Swap/Transfer

Input:

- A teammate requests either a task swap or one-way handoff and provides a short reason.

Writes:

- Create `task_reassignment_requests` with `status=pending`.

Decision:

- Counterparty accepts or rejects.

On accept:

- Update `tasks.assignee_user_id` based on request type (`swap` swaps two tasks; `handoff` reassigns one task).
- Mark request `status=accepted` and set response metadata.

On reject/cancel:

- Keep assignments unchanged.
- Mark request status accordingly.

Validation:

- Both users must be `project_members`.
- Request can only target tasks in the same project.
- Do not auto-move tasks without explicit acceptance.

### Flow 8: Requirement Change and Re-Planning

Input:

- Project scope changes, deadline shifts, or team composition changes.

Reads:

- Current `tasks`, `task_required_skills`, `task_dependencies`, `project_members`, effective skills.

Writes:

- Update `tasks` (titles, difficulty, due dates, and assignee only where reassignment policy allows).
- Upsert/delete `task_required_skills`.
- Upsert/delete `task_dependencies`.
- Keep `projects.planning_status=assigned` after re-plan unless team explicitly unlocks planning for full rework.

Re-Planning Policy (recommended):

- Keep completed tasks stable.
- Keep `in_progress` tasks with current owners unless a manual reassignment is explicitly approved.
- Re-plan only non-completed tasks when possible.
- Preserve manual edits unless explicitly overwritten.
- Minimize assignment churn: keep existing assignees when skill fit and load remain acceptable.
- Fairness guardrail: if a member already has disproportionately high completed/in-progress workload, bias new tasks toward other qualified members.
- Apply assignee changes preferentially to `todo` tasks; avoid moving active work unless requested/approved.

Output:

- Plan evolves without losing project continuity.

## Endpoint-to-Table Mapping (MVP)

- `GET/POST/PATCH /projects...` -> `projects`
- `POST /projects/:id/planning/lock` -> updates `projects.planning_status` to `locked`
- `POST /projects/:id/assignments/run` -> reads tasks/skills/members and writes `tasks.assignee_user_id`; updates `projects.planning_status` to `assigned`
- `POST /projects/:id/replan` -> updates tasks/dependencies/required-skills with stability and fairness policies
- `GET/POST/PATCH/DELETE /projects/:id/contexts...` -> `project_contexts`
- `GET/POST/DELETE /projects/:id/documents...` -> `project_documents` (metadata only; files in object storage)
- `POST /projects/:id/context/confidence` -> reads `project_contexts` (+ member skill context) and returns computed confidence
- `POST /projects/:id/context/clarify` -> returns up to 5 follow-up questions based on current context
- `POST /projects/:id/context/clarify-response` -> appends clarification Q/A into `project_contexts`, then recomputes confidence
- `GET/POST/PATCH/DELETE /projects/:id/members...` -> `project_members`
- `GET/POST/PATCH/DELETE /skills...` -> `skills`
- `GET/POST/PATCH/DELETE /users/:id/skills...` -> `user_skills`
- `GET/POST/PATCH/DELETE /projects/:id/members/:userId/skills...` -> `project_member_skills`
- `GET/POST/PATCH/DELETE /tasks...` -> `tasks`
- `GET /projects/:id/dashboard` -> reads `projects.deadline`, `tasks` (next milestone, team status), and member-scoped `tasks` (`assignee_user_id`)
- `GET /projects/:id/tasks/my` -> reads `tasks` filtered by (`project_id`, authenticated `assignee_user_id`) with `due_at` ordering
- `GET /projects/:id/tasks/:taskId/detail` -> reads `tasks`, `task_dependencies`, `task_required_skills`, `skills`, `project_member_skills` + fallback `user_skills`
- `GET /projects/:id/workflow/timeline/:taskId` -> reads `projects`, `tasks`, and `task_dependencies` for deterministic phase/dependency timing placement
- `GET/POST/PATCH/DELETE /tasks/:id/required-skills...` -> `task_required_skills`
- `GET/POST/DELETE /tasks/:id/dependencies...` -> `task_dependencies`
- `POST /projects/:id/task-reassignment-requests` -> create `task_reassignment_requests` (`swap` or `handoff`)
- `GET /projects/:id/task-reassignment-requests` -> list requests
- `POST /task-reassignment-requests/:id/respond` -> accept/reject and update `tasks.assignee_user_id` when accepted

## Implementation Notes

- Use UUIDs (or CUIDs) consistently for all IDs.
- Enforce unique constraints early to avoid duplicate membership/skill/dependency edges.
- Validate status and difficulty points at API boundary.
- For assignment decisions, compute effective skill levels by merging project overrides on top of global profile skills.
- For re-planning, treat assignment stability as an objective (not just raw best-fit skill score).
- Keep object storage and SQL responsibilities separated: SQL for metadata/indexing, object store for file bytes.
- Keep AI writes behind backend validation. AI should propose; backend should validate and persist.
- Use transactions for lock/assign/replan operations so task graph and assignments stay consistent.
- Restrict direct assignee edits in generic `PATCH /tasks/:id`; prefer assignment-run, re-plan policy, or accepted reassignment requests.
