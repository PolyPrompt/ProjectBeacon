# Agent UI: Visual + User-Flow QA (Playwright)

## Agent Identity
- `agent_id`: `agent_ui`
- Role: UI verification and bug-intake owner
- Fix owner for discovered UI defects: `agent3`

## Read Order
1. `ProjectBeacon/AGENTS.md`
2. `ProjectBeacon/TASK-agentUI.md`
3. `ProjectBeacon/API_CONTRACT.md`
4. `ProjectBeacon/DATAMODEL.md`
5. `ProjectBeacon/docs/ui` (all `screen.png` and `code.html` references)
6. `ProjectBeacon/HANDOFF.md`
7. `ProjectBeacon/HANDOFF.local.md` (if present)

## Primary Goal
- Start the local dev server.
- Validate that current UI matches `docs/ui` references.
- Validate that core user flow works end-to-end.
- On blocking error, stop and create a GitHub fix task for `agent3`.

## Setup and Run
From app root:

```bash
cd ProjectBeacon/ProjectBeacon
npm install
npm run dev
```

Use `http://localhost:3000` (or the port printed by Next.js if `3000` is busy).

## How to Test UI
Use Playwright as the primary UI checker.

Assume each scenario folder under `ProjectBeacon/docs/ui/*` contains both:
- `code.html` (structure/markup reference)
- `screen.png` (visual reference)

For every scenario, the agent should try to use both files together before deciding pass/fail.

1. Visual parity pass (`docs/ui` match):
   - For each scenario folder in `ProjectBeacon/docs/ui/*`:
     - read `code.html` and `screen.png` from that same folder
     - open the matching app route/state in the running app
     - compare against `code.html` for layout hierarchy, labels, actions, and key component states
     - compare against `screen.png` for visual structure and presentation
     - capture a current screenshot for evidence
2. User-flow pass (behavior):
   - verify page load without runtime crash
   - verify navigation actions are clickable and route correctly
   - verify key forms/actions submit and return expected success/error states
   - verify loading, empty, and error states are handled visibly
3. Runtime diagnostics:
   - capture browser console errors
   - capture failing network calls relevant to the broken flow

## Stop-and-File Rule (Mandatory)
If a blocking defect appears (runtime error, broken flow, severe visual mismatch), stop the current run and file a fix task immediately.

Create a GitHub issue assigned to `agent3` with labels:
- `agent3`
- `status:ready`
- `bug`

Recommended title format:
- `UI BUG: <short defect summary>`

Issue body must include:
- route/page
- exact reproduction steps
- expected behavior (from `docs/ui` or acceptance flow)
- actual behavior
- screenshots (`expected` vs `actual`) and console/network evidence
- severity (`blocker`, `high`, `medium`, `low`)
- suggested owner: `agent3`
- dependency line if needed (example: `deps: #123`)

## Command Template for Fix Task
```bash
gh issue create \
  --title "UI BUG: <short defect summary>" \
  --label "agent3" \
  --label "status:ready" \
  --label "bug"
```

Then assign to `agent3` (or mapped GitHub username for agent3) and add full defect details in the issue body/comment.

## Boundaries
- Do not implement feature fixes in this task file workflow.
- Do not change backend contracts while testing UI.
- Do not silently ignore visual or flow regressions.
- Do not continue test execution after a blocker is found; file handoff first.

## Output Contract
At end of run, update `ProjectBeacon/HANDOFF.local.md` with:
- routes/scenarios tested
- pass/fail matrix
- screenshots and evidence paths
- console/network error summary
- created GitHub issue links for any failures

Definition of done:
- all targeted UI scenarios are validated, or
- blockers are documented with filed fix tasks assigned/labeled for `agent3`.
