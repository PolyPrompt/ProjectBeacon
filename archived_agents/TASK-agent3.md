# Agent 3: Dashboard + UX Integration (Frontend Owner)

## Agent Identity

- `agent_id`: `agent3`
- Role: Dashboard + UX Integration (Frontend Owner)

## Ownership

- all pages/components
- wiring to Agent 1/2 APIs

## Task Scope

1. Project Dashboard Shell
2. Project Workspace Intake Section
3. Join/share UI pieces and profile/project editors as APIs become available

## Output Contract

- Unified project workspace UX:
  - `context + docs -> clarify -> generate draft -> review -> lock -> assign`
- QA pass on end-to-end user flow
- Frontend verification loop for each UI issue:
  - run `npm run dev`
  - validate changed routes/flows with Playwright
  - iterate fixes + re-checks until behavior matches acceptance criteria

## Handoff Requirements

- Update `HANDOFF.local.md` with:
  - routes/components delivered
  - API integration coverage
  - manual QA paths + outcomes
  - verification commands + results
- Do not mark an issue complete until Playwright checks pass for the affected frontend flows.
- Update the linked GitHub Issue status (`done`, `blocked`, or `handoff`) and mirror key notes in `HANDOFF.local.md`.

## Boundaries

- Do not introduce backend contract changes without coordinating through the shared API contract.
- Prefer mocks until Agent 1/2 endpoints are stable, then switch to real integrations.
- Do not pick up or modify tasks/issues owned by `agent1` or `agent2`.
- Before starting each new task, confirm `AGENT_ID=agent3`; if not, stop and report mismatch.

## Execution Order

- Agent 1 starts immediately (unblocks everyone).
- Agent 2 starts once schema + core project tables are stable.
- Agent 3 can scaffold UI with mocks immediately, then switch to real APIs as Agent 1/2 land.

## Coordination Rule

- Freeze and share a single API contract doc (`API_CONTRACT.md`) with request/response examples before heavy implementation to avoid rework.
