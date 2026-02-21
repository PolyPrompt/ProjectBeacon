You are `agent3` for this repo. Work autonomously and locally until all actionable Phase 2 tasks owned by `agent3` are complete or explicitly blocked.

Read and follow in order:
1) `ProjectBeacon/AGENTS.md`
2) `ProjectBeacon/TASK2-agent3.md`
3) `tasks2.md` (if missing, use `../tasks2.md`, then `ProjectBeacon/tasks2.md`)
4) `ProjectBeacon/API_CONTRACT.md`
5) `ProjectBeacon/DATAMODEL.md`
6) `ProjectBeacon/docs/ui` (images + html references)
7) `ProjectBeacon/HANDOFF.md`
8) `ProjectBeacon/HANDOFF.local.md` (if present)

Execution rules:
- Only execute tasks owned by `agent3` (`PB-024` to `PB-029`).
- Intake only from GitHub Issues (`status:ready` + `agent3` labels).
- Build strictly to `API_CONTRACT.md`; do not invent backend fields.
- Implement the 5-button post-onboarding navbar: `Dashboard`, `Documents`, `Board`, `Timeline`, `Settings`.
- Dashboard must include:
  - next due milestone and overall deadline
  - my-tasks table sorted by soft deadline
  - task detail modal (soft deadline, description, assignment reasoning, timeline deep-link)
- Workflow must include explicit `Timeline <-> Board` view switching.
- Documents must support popup/embed preview from signed URL retrieval endpoints.
- Handle loading/empty/error states.
- Run required checks after meaningful changes:
  - `npm run format:check`
  - `npm run lint`
  - `npm run build`
- Update `ProjectBeacon/HANDOFF.md` after each task milestone.
- Update `ProjectBeacon/DECISIONS.md` for major UX/flow decisions.

Primary goals tonight:
- `PB-024` post-onboarding shell + navbar
- `PB-025` dashboard + task detail modal
- `PB-026` documents page + preview/embed
- `PB-027` settings page
- `PB-028` board/timeline pages
- `PB-029` final role QA matrix + handoff

Continuous loop (repeat until done):
1) Refresh issue queue:
   - `gh issue list --state open --label agent3 --label status:ready --limit 200`
2) If no ready issues remain for `agent3`:
   - write final summary in `ProjectBeacon/HANDOFF.md`
   - stop.
3) Pick next issue (dependency-ready, oldest first), then:
   - claim issue (`status:in-progress`)
   - implement acceptance criteria with contract-first wiring
   - run required checks
   - update docs/UI notes and intentional deviations in handoff
   - commit and open/update PR referencing the issue
   - update issue status (`done`, `blocked`, or `handoff`) and add handoff comment
   - log outcome in `ProjectBeacon/HANDOFF.md`
4) Start next loop cycle immediately.

Blocking policy:
- If AGENT_ID mismatch, stop and report mismatch.
- If Agent 1/2 APIs are not ready, keep explicit scaffold behavior and mark blockers clearly.
- If contract gaps block implementation, pause and resolve contract changes first.

Definition of done:
- All `agent3` Phase 2 issues are either:
  - completed and handed off with passing checks, or
  - clearly blocked with explicit blocker notes and next action.
