You are `agent1` for this repo. Work autonomously and locally until all actionable Phase 2 tasks owned by `agent1` are complete or explicitly blocked.

Read and follow in order:
1) `ProjectBeacon/AGENTS.md`
2) `ProjectBeacon/TASK2-agent1.md`
3) `tasks2.md` (if missing, use `../tasks2.md`, then `ProjectBeacon/tasks2.md`)
4) `ProjectBeacon/API_CONTRACT.md`
5) `ProjectBeacon/DATAMODEL.md`
6) `ProjectBeacon/HANDOFF.md`
7) `ProjectBeacon/HANDOFF.local.md` (if present)

Execution rules:
- Only execute tasks owned by `agent1` (`PB-017` to `PB-020`).
- Use GitHub Issues as source of truth for intake (`status:ready` + `agent1` labels).
- Enforce role/auth correctness first; do not bypass auth for convenience.
- Keep API changes contract-first: update `API_CONTRACT.md` before broad endpoint implementation when shapes change.
- Run required checks after meaningful changes:
  - `npm run format:check`
  - `npm run lint`
  - `npm run build`
- Update `ProjectBeacon/HANDOFF.md` after each task milestone.
- Update `ProjectBeacon/DECISIONS.md` for major auth/role/data-policy decisions.

Primary goals tonight:
- `PB-017` Clerk Auth Foundation and Route Protection
- `PB-018` Project Membership Roles and Authorization Guards
- `PB-019` Settings APIs (share/leave/admin controls)
- `PB-020` Documents access + signed retrieval APIs

Continuous loop (repeat until done):
1) Refresh issue queue:
   - `gh issue list --state open --label agent1 --label status:ready --limit 200`
2) If no ready issues remain for `agent1`:
   - write final summary in `ProjectBeacon/HANDOFF.md`
   - stop.
3) Pick next issue (dependency-ready, oldest first), then:
   - claim issue (`status:in-progress`)
   - implement acceptance criteria with minimal scope changes
   - run required checks
   - update docs/contracts if behavior changed
   - commit and open/update PR referencing the issue
   - update issue status (`done`, `blocked`, or `handoff`) and add handoff comment
   - log outcome in `ProjectBeacon/HANDOFF.md`
4) Start next loop cycle immediately.

Blocking policy:
- If AGENT_ID mismatch, stop and report mismatch.
- If dependencies are unresolved or issue is ambiguous, mark `blocked` with concrete blocker notes.
- If API contract conflict appears across agents, pause implementation and resolve in `API_CONTRACT.md` first.

Definition of done:
- All `agent1` Phase 2 issues are either:
  - completed and handed off with passing checks, or
  - clearly blocked with explicit blocker notes and next action.
