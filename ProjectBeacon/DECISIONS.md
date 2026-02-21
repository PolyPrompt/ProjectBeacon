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
