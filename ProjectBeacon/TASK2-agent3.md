# Agent 3: Post-Onboarding UX Integration (Phase 2 Owner)

## Agent Identity
- `agent_id`: `agent3`
- Role: Post-Onboarding UX Integration (Phase 2 Owner)

## Ownership
- authenticated app shell + 5-button navbar
- dashboard UX (countdowns, my tasks table, task detail modal)
- documents page UX (including preview/embed flows)
- settings page UX with role-aware controls
- workflow UX (`board` and `timeline`) and deep-link behavior
- final end-to-end role QA matrix + handoff

## Task Scope
1. `PB-024` Authenticated Post-Onboarding App Shell + 5-Button Navbar
2. `PB-025` Dashboard Page (My Tasks + Countdowns + Team Status)
3. `PB-026` Documents Page (Admin Manage, User Read-Only Assigned)
4. `PB-027` Settings Page (Share, Leave, and Admin Project Controls)
5. `PB-028` Workflow Pages (Board + Timeline) in Navbar Flow
6. `PB-029` End-to-End Role QA Matrix and Handoff Signoff

## Output Contract
- Unified post-onboarding UX:
  - `Dashboard`, `Documents`, `Board`, `Timeline`, `Settings`
- Role-aware behavior:
  - `admin`: full controls
  - `user`: restricted controls with read-only where required
- Final QA matrix for both roles across all pages

## Handoff Requirements
- Update `HANDOFF.local.md` with:
  - routes/components delivered
  - API integration coverage
  - manual QA paths + outcomes
  - verification commands + results
- Update linked GitHub Issue status (`done`, `blocked`, or `handoff`) and mirror key notes in `HANDOFF.local.md`.

## Boundaries
- Do not introduce backend contract changes without coordinating through `API_CONTRACT.md`.
- Prefer scaffold states only until Agent 1/2 APIs are available, then switch to live endpoints.
- Do not pick up or modify tasks/issues owned by `agent1` or `agent2`.
- Before starting each new task, confirm `AGENT_ID=agent3`; if not, stop and report mismatch.

## Execution Order
- Start shell/nav scaffolding (`PB-024`) as soon as auth gates are in place.
- Move to dashboard/documents/settings as corresponding APIs stabilize.
- Finish with workflow pages and full-role QA matrix (`PB-029`).

## Coordination Rule
- Keep UX wiring contract-first using `API_CONTRACT.md`; do not assume unstated fields.
