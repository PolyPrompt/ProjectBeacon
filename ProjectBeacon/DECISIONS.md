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
