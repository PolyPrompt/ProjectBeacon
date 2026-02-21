You are `agent2` for this repo. Work autonomously and locally until all actionable MVP V0 tasks owned by `agent2` are complete or explicitly blocked.

Read and follow in order:
1) `ProjectBeacon/AGENTS.md`
2) `ProjectBeacon/TASKMVP-agent2.md`
3) `ProjectBeacon/MVP_REFERENCE_V0.md`
4) `ProjectBeacon/API_CONTRACT.md`
5) `ProjectBeacon/DATAMODEL.md`
6) `ProjectBeacon/HANDOFF.md`
7) `ProjectBeacon/HANDOFF.local.md` (if present)

Execution rules:
- Only execute tasks owned by `agent2`.
- Intake only from GitHub Issues (`status:ready` + `agent2` labels).
- Keep scope within V0 features from `MVP_REFERENCE_V0.md`.
- Implement DTO/endpoint behavior exactly as frozen in `API_CONTRACT.md`.
- Keep planning and workflow logic deterministic and testable.
- Run required checks after meaningful changes:
  - `npm run format:check`
  - `npm run lint`
  - `npm run build`
- Update `ProjectBeacon/HANDOFF.md` after each milestone.
- Update `ProjectBeacon/DECISIONS.md` for major algorithm/contract decisions.

Primary goals:
- Deliver all V0 planning and workflow intelligence backend required by MVP.
- Provide stable API contracts for `agent3` UI integration.

Continuous loop (repeat until done):
1) Refresh issue queue:
   - `gh issue list --state open --label agent2 --label status:ready --limit 200 --json number,title,createdAt,labels,url,body`
2) If no ready issues remain for `agent2`:
   - write final summary in `ProjectBeacon/HANDOFF.md`
   - stop.
3) Pick next issue (dependency-ready, oldest first), then:
   - verify `AGENT_ID=agent2`; if mismatch, stop and report
   - claim issue (`status:in-progress`)
   - implement acceptance criteria with minimal scope
   - run required checks
   - update `API_CONTRACT.md`/`DATAMODEL.md` when behavior or shapes changed
   - commit and open/update PR referencing the issue (`Closes #<id>`)
   - update issue status (`done`, `blocked`, or `handoff`) with summary comment
   - log outcome in `ProjectBeacon/HANDOFF.md`
4) Start next loop cycle immediately.

Blocking policy:
- If Agent 1 prerequisites (auth/roles/policies/data contracts) are not ready, mark blocked with explicit issue dependency.
- If dependency semantics conflict with contract/model, resolve docs first, then continue implementation.
- If AGENT_ID mismatches, stop immediately.

Definition of done:
- All `agent2` MVP V0 issues are either:
  - completed and handed off with passing checks, or
  - clearly blocked with explicit blocker notes and next action.
