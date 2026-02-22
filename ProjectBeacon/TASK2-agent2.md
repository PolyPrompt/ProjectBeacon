# Agent 2: Dashboard + Workflow Data APIs (Phase 2 Owner)

## Agent Identity

- `agent_id`: `agent2`
- Role: Dashboard + Workflow Data APIs (Phase 2 Owner)

## Ownership

- dashboard read models and summary APIs
- task detail modal payload APIs
- task-specific timeline positioning/dependency APIs
- workflow aggregate APIs (`board`, `timeline`)
- assignment reasoning and timeline/phase read-model logic

## Task Scope

1. `PB-021` Dashboard Summary + My Tasks APIs (Soft Deadline Sorted)
2. `PB-022` Task Detail Modal and Task-Specific Timeline APIs
3. `PB-023` Workflow Board and Timeline Aggregate APIs

## Output Contract

- Stable dashboard/workflow DTOs and endpoints for Agent 3 integration
- Sorting/phase/dependency/assignment-reasoning behavior aligned to `tasks2.md`
- Contract updates documented in `API_CONTRACT.md`

## Handoff Requirements

- Update `HANDOFF.local.md` with:
  - final request/response schemas
  - sorting/placement/reasoning rules
  - dependency validation behavior
  - verification commands + results
- Update linked GitHub Issue status (`done`, `blocked`, or `handoff`) and mirror key notes in `HANDOFF.local.md`.

## Boundaries

- Depend on Agent 1 auth/role gates; do not rewrite auth primitives without coordination.
- Do not implement settings/documents auth APIs owned by Agent 1.
- Do not implement full page UX owned by Agent 3.
- Do not pick up or modify tasks/issues owned by `agent1` or `agent3`.
- Before starting each new task, confirm `AGENT_ID=agent2`; if not, stop and report mismatch.

## Execution Order

- Start once `PB-018` role guards are stable.
- Complete `PB-021` before modal/timeline detail work in `PB-022`.
- Complete `PB-023` to unblock board/timeline pages in Agent 3.

## Coordination Rule

- Freeze and share endpoint contracts in `API_CONTRACT.md` before frontend wiring to avoid drift.
