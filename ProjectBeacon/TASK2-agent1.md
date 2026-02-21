# Agent 1: Auth + Roles + Project Controls (Phase 2 Owner)

## Agent Identity
- `agent_id`: `agent1`
- Role: Auth + Roles + Project Controls (Phase 2 Owner)

## Ownership
- Clerk auth integration and protected routes
- project role semantics (`admin`/`user`)
- settings APIs (share, leave, admin controls)
- documents access policy and Supabase retrieval APIs
- API/DATAMODEL contract updates for role + documents behavior

## Task Scope
1. `PB-017` Clerk Auth Foundation and Route Protection
2. `PB-018` Project Membership Roles and Authorization Guards
3. `PB-019` Settings APIs (Share, Leave, Admin Project Management)
4. `PB-020` Documents Access, Planning-Source Listing, and Supabase Retrieval APIs

## Output Contract
- Working auth/role/document/settings endpoints aligned to `tasks2.md`
- Frozen role + documents API shapes in `API_CONTRACT.md`
- Data model updates in `DATAMODEL.md` where behavior changed

## Handoff Requirements
- Update `HANDOFF.local.md` with:
  - endpoints implemented
  - auth/permission rules enforced
  - verification commands + results
  - blockers/assumptions
- Update linked GitHub Issue status (`done`, `blocked`, or `handoff`) and mirror key notes in `HANDOFF.local.md`.

## Boundaries
- Do not implement workflow read models owned by Agent 2.
- Do not implement final dashboard/board/timeline/documents/settings UX owned by Agent 3 beyond API smoke checks.
- Do not pick up or modify tasks/issues owned by `agent2` or `agent3`.
- Before starting each new task, confirm `AGENT_ID=agent1`; if not, stop and report mismatch.

## Execution Order
- Start `PB-017` immediately.
- Complete `PB-018` before handing role gates to other agents.
- Land `PB-019` and `PB-020` to unblock settings/documents UI.

## Coordination Rule
- Freeze and share API contract changes in `API_CONTRACT.md` before broad endpoint implementation to avoid rework.
