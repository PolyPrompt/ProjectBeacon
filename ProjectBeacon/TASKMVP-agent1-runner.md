You are `agent1` for this repo. Work autonomously and locally until all actionable MVP V0 tasks owned by `agent1` are complete or explicitly blocked.

Read and follow in order:

1. `ProjectBeacon/AGENTS.md`
2. `ProjectBeacon/TASKMVP-agent1.md`
3. `ProjectBeacon/MVP_REFERENCE_V0.md`
4. `ProjectBeacon/API_CONTRACT.md`
5. `ProjectBeacon/DATAMODEL.md`
6. `ProjectBeacon/HANDOFF.md`
7. `ProjectBeacon/HANDOFF.local.md` (if present)

Execution rules:

- Only execute tasks owned by `agent1`.
- Intake only from GitHub Issues (`status:ready` + `agent1` labels).
- Keep scope within V0 features from `MVP_REFERENCE_V0.md`.
- Implement to `API_CONTRACT.md`; do not invent unstated fields.
- Keep auth/membership/role gates consistent across all protected APIs.
- Run required checks after meaningful changes:
  - `npm run format:check`
  - `npm run lint`
  - `npm run build`
- Update `ProjectBeacon/HANDOFF.md` after each milestone.
- Update `ProjectBeacon/DECISIONS.md` for major policy/data decisions.

Primary goals:

- Deliver all V0 platform/data APIs and policy enforcement required by MVP.
- Unblock downstream `agent2` and `agent3` integration work.

Continuous loop (repeat until done):

1. Refresh issue queue:
   - `gh issue list --state open --label agent1 --label status:ready --limit 200 --json number,title,createdAt,labels,url,body`
2. If no ready issues remain for `agent1`:
   - write final summary in `ProjectBeacon/HANDOFF.md`
   - stop.
3. Pick next issue (dependency-ready, oldest first), then:
   - verify `AGENT_ID=agent1`; if mismatch, stop and report
   - claim issue (`status:in-progress`)
   - implement acceptance criteria with minimal scope
   - run required checks
   - update `API_CONTRACT.md`/`DATAMODEL.md` when behavior or shapes changed
   - commit and open/update PR referencing the issue (`Closes #<id>`)
   - update issue status (`done`, `blocked`, or `handoff`) with summary comment
   - log outcome in `ProjectBeacon/HANDOFF.md`
4. Start next loop cycle immediately.

Blocking policy:

- If dependency issue is not done, mark blocked with explicit dependency reference.
- If auth/data policy conflicts with existing contracts, resolve by updating contract docs before coding further.
- If AGENT_ID mismatches, stop immediately.

Definition of done:

- All `agent1` MVP V0 issues are either:
  - completed and handed off with passing checks, or
  - clearly blocked with explicit blocker notes and next action.
