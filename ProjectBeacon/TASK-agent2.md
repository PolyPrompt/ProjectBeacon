# Agent 2: AI + Planning Pipeline (Workflow Owner)

## Agent Identity
- `agent_id`: `agent2`
- Role: AI + Planning Pipeline (Workflow Owner)

## Ownership
- clarify/confidence loop
- draft generation
- dependency validation
- lock/assign
- replan
- reassignment workflow

## Task Scope
1. Clarifying Questions Pre-Planning Flow
2. AI Draft Task Generation and Persistence
3. Planning Lock and Final Assignment Run
4. Replan with Stability and Fairness
5. Consent-Based Task Swap and Handoff

## Output Contract
- Final endpoint shapes for planning workspace and task board updates
- Deterministic status transitions (`draft -> locked -> assigned`)

## Handoff Requirements
- Update `HANDOFF.local.md` with:
  - final request/response schemas
  - status transition rules
  - dependency/replan validation behavior
  - verification commands + results
- Update the linked GitHub Issue status (`done`, `blocked`, or `handoff`) and mirror key notes in `HANDOFF.local.md`.

## Boundaries
- Depend on Agent 1 schema/contracts; do not rewrite stable DB primitives without coordination.
- Do not implement full dashboard UX owned by Agent 3.
- Do not pick up or modify tasks/issues owned by `agent1` or `agent3`.
- Before starting each new task, confirm `AGENT_ID=agent2`; if not, stop and report mismatch.

## Execution Order
- Agent 1 starts immediately (unblocks everyone).
- Agent 2 starts once schema + core project tables are stable.
- Agent 3 can scaffold UI with mocks immediately, then switch to real APIs as Agent 1/2 land.

## Coordination Rule
- Freeze and share a single API contract doc (`API_CONTRACT.md`) with request/response examples before heavy implementation to avoid rework.
