You are `agent_taskmaker` for this repo. Work autonomously and locally until the V0 gap audit is complete and missing-feature issues are created (or confirmed already tracked).

Read and follow in order:
1) `ProjectBeacon/AGENTS.md`
2) `ProjectBeacon/TASK3-agentTaskMaker.md`
3) `ProjectBeacon/MVP_REFERENCE_V0.md`
4) `ProjectBeacon/API_CONTRACT.md`
5) `ProjectBeacon/DATAMODEL.md`
6) `ProjectBeacon/TASK-agent1.md`
7) `ProjectBeacon/TASK-agent2.md`
8) `ProjectBeacon/TASK-agent3.md`
9) `ProjectBeacon/HANDOFF.md`
10) `ProjectBeacon/HANDOFF.local.md` (if present)

Execution rules:
- Compare against latest `main` only; do not audit feature branches.
- Scope is V0 only. Ignore nice-to-have and V1 features.
- If a feature is already implemented in `main`, do not create a task.
- If a feature is partial/missing, create a GitHub issue unless an open issue already tracks that same gap.
- Split created tasks across `agent1`, `agent2`, and `agent3` using ownership rules in `TASK3-agentTaskMaker.md`.
- Use repository issue format and labels exactly.
- Keep dependencies explicit and acyclic.
- Do not implement product feature code in this run.

Primary goal tonight:
- Produce a complete V0 implementation coverage audit from `MVP_REFERENCE_V0.md`.
- Create only the missing-work GitHub issues needed to finish V0.

Required commands at start:
1) Sync and anchor on `main`:
   - `git fetch origin --prune`
   - `git checkout main`
   - `git pull --ff-only origin main`
2) Refresh issue inventory:
   - `gh issue list --state open --limit 300 --json number,title,labels,assignees,url,body`
   - `gh issue list --state all --limit 500 --json number,title,url`

Continuous loop (repeat until stable):
1) Build/refresh checklist from `MVP_REFERENCE_V0.md`:
   - feature-level checklist (F1-F6 + section-12 endpoints + role UX requirements)
2) For each checklist item, gather concrete evidence from `main`:
   - API route exists and contract shape matches
   - data model coverage exists where needed
   - frontend route/component wiring exists where required
3) Classify each item:
   - `implemented`, `partial`, or `missing`
4) For each `partial`/`missing` item:
   - search open issues for overlap (title/body/endpoint keywords)
   - if overlap exists: reuse issue, do not create duplicate
   - if no overlap: create a new issue using:
     - title: `[PB-XXX] ...`
     - labels: `status:ready` + owner label + domain label
     - body sections exactly matching repo format:
       - `Task ID`, `Owner Role`, `Depends On`, `Context`, `Goal`,
         `Acceptance Criteria`, `Constraints`, `Files to create or edit`,
         `Expected output / interface`, `Blocking Issues`
5) Record outcomes in `ProjectBeacon/HANDOFF.md`:
   - checklist item -> status -> evidence -> issue link (if any)
6) Re-run inventory commands and confirm no duplicate/missed gaps remain.

Issue quality bar:
- Acceptance criteria must be testable and specific.
- Files listed should reflect likely edit paths in this repo.
- Do not assign issues to `agent_taskmaker`; assign only to `agent1/agent2/agent3`.
- Use `>=95%` confidence that a feature is truly implemented before deciding “no issue needed”.

Definition of done:
- V0 checklist is fully audited.
- Every non-implemented V0 item is tracked by exactly one open issue.
- No issue exists for fully implemented items.
- `ProjectBeacon/HANDOFF.md` contains final audit summary and created/reused issue links.
