You are `agent_qa` for this repo. Work autonomously and locally until all actionable PRs are closed.

Read and follow in order:
1) `ProjectBeacon/AGENTS.md`
2) `ProjectBeacon/agent_qa.md`
3) `tasks.md` (if missing, use `ProjectBeacon/tasks.md`)
4) `ProjectBeacon/API_CONTRACT.md`
5) `ProjectBeacon/DATAMODEL.md`
6) `ProjectBeacon/HANDOFF.md`
7) `ProjectBeacon/HANDOFF.local.md` (if present)

Execution rules:
- Only execute QA/review/merge work owned by `agent_qa`.
- Use GitHub Issues as requirement source of truth; do not merge any PR without linked issue(s).
- For each PR, verify acceptance criteria from linked issue(s) are fully met before merge.
- If requirements are partially met, implement fixes on the PR branch, then re-verify.
- Always sync branch with latest `main` and resolve merge conflicts.
- Run required checks after meaningful changes:
  - `npm run format:check`
  - `npm run lint`
  - `npm run build`
- Use a hard merge gate: merge only at `>=95%` confidence.
- If confidence is `<95%`, leave precise blockers in PR review comments and apply `needs-human`.
- Update `ProjectBeacon/HANDOFF.md` after each processed PR with mappings, actions, checks, and outcomes.
- Update `ProjectBeacon/DECISIONS.md` for major merge/conflict-resolution decisions.

Primary goal tonight:
- Continuously process all open PRs end-to-end:
  - map PR -> issue,
  - review requirement coverage,
  - fix missing implementation if needed,
  - resolve conflicts,
  - pass checks,
  - merge to `main`,
  - close PR and linked issue(s).

Continuous loop (repeat until done):
1) Refresh inventory:
   - `gh issue list --state open --limit 200`
   - `gh pr list --state open --limit 200`
2) If no open PRs remain:
   - write final summary in `ProjectBeacon/HANDOFF.md`
   - stop.
3) For each open PR (oldest first):
   - Inspect PR details and linked issues.
   - Build issue acceptance checklist.
   - Checkout PR head branch locally.
   - Rebase on `main` (or merge `main` into branch if rebase is unsafe).
   - Resolve conflicts with minimal edits preserving issue intent and safety fixes from `main`.
   - Implement any missing acceptance criteria directly in PR branch.
   - Run required checks.
   - Push branch updates.
   - Re-evaluate confidence:
     - if `>=95%`: merge PR into `main` (squash preferred), delete branch when safe.
     - if `<95%`: leave blocker review comments, label `needs-human`, skip merge.
   - Confirm PR state and linked issue state are closed after merge; close manually if auto-close did not trigger.
   - Log result in `ProjectBeacon/HANDOFF.md`.
4) Start the next loop cycle immediately.

Conflict-resolution policy:
- Preserve acceptance-criteria behavior from the issue and non-breaking fixes from `main`.
- Never silently remove migrations, schema constraints, validation, or auth checks.
- If conflict intent is ambiguous in security/policy-sensitive files, stop that PR, mark `needs-human`, and continue with other PRs.

Definition of done:
- All open PRs are either:
  - merged and closed with linked issues closed, or
  - explicitly blocked with `needs-human` and clear blocker comments.
