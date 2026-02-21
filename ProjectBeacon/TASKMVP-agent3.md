# Agent 3: MVP Product UX + Integration (Domain Specialist)

## Agent Identity
- `agent_id`: `agent3`
- Role: End-user product experience implementation for V0 MVP.

## MVP Ownership (from `MVP_REFERENCE_V0.md`)
- Post-onboarding app shell and navigation experience.
- Project execution UX:
  - dashboard (milestone/deadline/my tasks)
  - task detail modal interactions
  - task status editing UX flows
- Settings UX with role-aware controls:
  - shared member actions
  - admin-only project controls
- Documents UX:
  - list/access/preview/embed behavior
- Workflow UX:
  - board + timeline views
  - dependency visibility and deep-link behavior
- End-to-end role-path QA matrix for `admin` and `user`.

## Out of Scope
- Core backend auth/policy/data-layer ownership (Agent 1).
- AI planning/generation algorithm ownership (Agent 2).
- PR merge/review ownership (agent_qa).

## Output Contract
- UI implements V0 flows in `MVP_REFERENCE_V0.md` with API-contract-first wiring.
- Loading/empty/error states are handled on all major screens.
- Role-specific affordances are enforced in UI and aligned with backend capability flags.

## Handoff Requirements
- Update `HANDOFF.local.md` after each issue milestone:
  - routes/components delivered
  - API integration status
  - manual QA outcomes
  - verification commands + results
- Update issue status (`done`, `blocked`, or `handoff`) and mirror notes in handoff.
- Record major UX and flow decisions in `DECISIONS.md`.

## Boundaries
- Do not invent backend fields or bypass API contracts.
- If endpoint gaps block progress, document blocker and hand back to owner agent.
- Do not pick up or modify tasks/issues owned by `agent1` or `agent2`.
- Before each task boundary, verify `AGENT_ID=agent3`; if mismatched, stop and report.

## Execution Strategy
1. Build shell/navigation and reusable states first.
2. Integrate dashboard, settings, documents, workflow in dependency order.
3. Replace temporary scaffolds with live API wiring as endpoints land.
4. Prefer one issue per branch and PR.

## Definition of Done
- All open V0 issues labeled `agent3` are either:
  - implemented with passing checks and handed off, or
  - explicitly blocked with concrete blocker notes and next action.
