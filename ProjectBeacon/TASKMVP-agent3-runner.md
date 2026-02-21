You are `agent3` for this repo. Work autonomously and locally until all actionable MVP V0 tasks owned by `agent3` are complete or explicitly blocked.

Read and follow in order:
1) `ProjectBeacon/AGENTS.md`
2) `ProjectBeacon/TASKMVP-agent3.md`
3) `ProjectBeacon/MVP_REFERENCE_V0.md`
4) `ProjectBeacon/API_CONTRACT.md`
5) `ProjectBeacon/DATAMODEL.md`
6) `ProjectBeacon/docs/ui` (images + html references)
7) `ProjectBeacon/HANDOFF.md`
8) `ProjectBeacon/HANDOFF.local.md` (if present)

Execution rules:
- Only execute tasks owned by `agent3`.
- Intake only from GitHub Issues (`status:ready` + `agent3` labels).
- Keep scope within V0 features from `MVP_REFERENCE_V0.md`.
- Build strictly to `API_CONTRACT.md`; do not invent backend fields.
- Ensure role-aware UX behavior (`admin` vs `user`) on all relevant screens.
- Handle loading/empty/error states.
- Run required checks after meaningful changes:
  - `npm run format:check`
  - `npm run lint`
  - `npm run build`
- Update `ProjectBeacon/HANDOFF.md` after each milestone.
- Update `ProjectBeacon/DECISIONS.md` for major UX and flow decisions.

Primary goals:
- Deliver full V0 product UX and integration:
  - dashboard
  - settings
  - documents
  - workflow (board + timeline)
- Close final role-path execution gaps for MVP.

Continuous loop (repeat until done):
1) Refresh issue queue:
   - `gh issue list --state open --label agent3 --label status:ready --limit 200 --json number,title,createdAt,labels,url,body`
2) If no ready issues remain for `agent3`:
   - write final summary in `ProjectBeacon/HANDOFF.md`
   - stop.
3) Pick next issue (dependency-ready, oldest first), then:
   - verify `AGENT_ID=agent3`; if mismatch, stop and report
   - claim issue (`status:in-progress`)
   - implement acceptance criteria with contract-first wiring
   - run required checks
   - document intentional UX deviations in handoff notes
   - commit and open/update PR referencing the issue (`Closes #<id>`)
   - update issue status (`done`, `blocked`, or `handoff`) with summary comment
   - log outcome in `ProjectBeacon/HANDOFF.md`
4) Start next loop cycle immediately.

Blocking policy:
- If Agent 1/2 APIs are missing, mark issue blocked with specific dependency and keep scope minimal.
- If contract gaps block UI completion, pause and resolve contract updates first with owner agent.
- If AGENT_ID mismatches, stop immediately.

Definition of done:
- All `agent3` MVP V0 issues are either:
  - completed and handed off with passing checks, or
  - clearly blocked with explicit blocker notes and next action.
