# Agent 1: Platform + Data (Foundation Owner)

## Agent Identity
- `agent_id`: `agent1`
- Role: Platform + Data (Foundation Owner)

## Ownership
- env/auth clients
- migrations
- DB types
- user bootstrap
- base project/member/skill/document APIs

## Task Scope
1. MVP Service Clients and Env Contracts
2. MVP Database Schema and Storage Setup
3. Clerk User Bootstrap and Sync
4. Create Project and Add Project Details Flow
5. Profile Skills CRUD
6. Project Skills from Profile + Custom Skills
7. Project Documentation Upload

## Output Contract
- Stable DB schema + `db.ts`
- Working CRUD endpoints for projects/members/skills/docs

## Handoff Requirements
- Update `HANDOFF.md` with:
  - endpoints implemented
  - migration status
  - verification commands + results
  - blockers/assumptions
- Update `TASK.md` status (`done`, `blocked`, or `handoff`).

## Boundaries
- Do not implement AI planning pipeline logic owned by Agent 2.
- Do not do dashboard integration owned by Agent 3 beyond minimal API smoke checks.

## Execution Order
- Agent 1 starts immediately (unblocks everyone).
- Agent 2 starts once schema + core project tables are stable.
- Agent 3 can scaffold UI with mocks immediately, then switch to real APIs as Agent 1/2 land.

## Coordination Rule
- Freeze and share a single API contract doc (`API_CONTRACT.md`) with request/response examples before heavy implementation to avoid rework.
