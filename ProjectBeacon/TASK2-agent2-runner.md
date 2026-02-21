You are `agent2` for this repo. Work autonomously and locally until all actionable Phase 2 tasks owned by `agent2` are complete or explicitly blocked.

Read and follow in order:
1) `ProjectBeacon/AGENTS.md`
2) `ProjectBeacon/TASK2-agent2.md`
3) `tasks2.md` (if missing, use `../tasks2.md`, then `ProjectBeacon/tasks2.md`)
4) `ProjectBeacon/API_CONTRACT.md`
5) `ProjectBeacon/DATAMODEL.md`
6) `ProjectBeacon/HANDOFF.md`
7) `ProjectBeacon/HANDOFF.local.md` (if present)

Execution rules:
- Only execute tasks owned by `agent2` (`PB-021` to `PB-023`).
- Intake only from GitHub Issues (`status:ready` + `agent2` labels).
- Do not start if `PB-018` role/auth gating is not stable.
- Implement DTOs/endpoint shapes exactly as frozen in `API_CONTRACT.md`; do not invent unstated fields.
- Keep timeline/dependency logic deterministic and testable.
- Run required checks after meaningful changes:
  - `npm run format:check`
  - `npm run lint`
  - `npm run build`
- Update `ProjectBeacon/HANDOFF.md` after each task milestone.
- Update `ProjectBeacon/DECISIONS.md` for major read-model/algorithm decisions.

Primary goals tonight:
- `PB-021` Dashboard Summary + My Tasks APIs (soft deadline sorting)
- `PB-022` Task detail modal + task-specific timeline APIs
- `PB-023` Workflow board/timeline aggregate APIs

Continuous loop (repeat until done):
1) Refresh issue queue:
   - `gh issue list --state open --label agent2 --label status:ready --limit 200`
2) If no ready issues remain for `agent2`:
   - write final summary in `ProjectBeacon/HANDOFF.md`
   - stop.
3) Pick next issue (dependency-ready, oldest first), then:
   - claim issue (`status:in-progress`)
   - implement acceptance criteria with minimal scope
   - run required checks
   - update `API_CONTRACT.md` if endpoint shapes changed
   - commit and open/update PR referencing the issue
   - update issue status (`done`, `blocked`, or `handoff`) and add handoff comment
   - log outcome in `ProjectBeacon/HANDOFF.md`
4) Start next loop cycle immediately.

Blocking policy:
- If AGENT_ID mismatch, stop and report mismatch.
- If Agent 1 prerequisites are missing, mark blocked with specific dependency reference.
- If dependency/timeline semantics conflict with data model, resolve by updating `API_CONTRACT.md` + `DATAMODEL.md` before coding further.

Definition of done:
- All `agent2` Phase 2 issues are either:
  - completed and handed off with passing checks, or
  - clearly blocked with explicit blocker notes and next action.
