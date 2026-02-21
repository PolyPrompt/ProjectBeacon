# Agent 1: MVP Platform + Data Core (Domain Specialist)

## Agent Identity
- `agent_id`: `agent1`
- Role: Platform/Data foundation and policy enforcement for V0 MVP.

## MVP Ownership (from `MVP_REFERENCE_V0.md`)
- Authentication and identity bootstrap plumbing.
- Project membership and role model (`admin` / `user`) enforcement.
- Project lifecycle backend:
  - create/read/update/delete policy
  - share/join/leave/settings capability APIs
- Skills backend:
  - profile skills CRUD
  - project skill import/override flows
- Documents backend:
  - upload/list/access control
  - signed retrieval support
  - planning-source document listing
- Data model and contract integrity:
  - schema alignment
  - API contract updates
  - stable error envelopes and authorization checks

## Out of Scope
- AI planning/generation/assignment algorithms (Agent 2).
- Full page-level UX implementation (Agent 3).
- PR merge/review ownership (agent_qa).

## Output Contract
- Backend endpoints are contract-stable and role-safe.
- Every API uses deterministic error format and project membership checks.
- `API_CONTRACT.md` and `DATAMODEL.md` stay in sync with implementation.

## Handoff Requirements
- Update `HANDOFF.local.md` after each issue milestone:
  - issue id + scope completed
  - API/database changes
  - commands run + results
  - blockers and dependency references
- Update issue status (`done`, `blocked`, or `handoff`) and mirror the same summary in handoff notes.
- Record major architecture/policy decisions in `DECISIONS.md`.

## Boundaries
- Do not implement AI generation logic or workflow ranking logic owned by Agent 2.
- Do not implement final UX flows owned by Agent 3 beyond basic API smoke verification.
- Do not pick up or modify tasks/issues owned by `agent2` or `agent3`.
- Before each task boundary, verify `AGENT_ID=agent1`; if mismatched, stop and report.

## Execution Strategy
1. Start from dependency-unblocking backend issues first.
2. Land auth/role/policy before higher-level feature APIs.
3. Keep changes minimal and contract-first; avoid speculative fields.
4. Prefer one task/issue per branch and PR.

## Definition of Done
- All open V0 issues labeled `agent1` are either:
  - implemented with passing checks and handed off, or
  - explicitly blocked with concrete blocker notes and next action.
