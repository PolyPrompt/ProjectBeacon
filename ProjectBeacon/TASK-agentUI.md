# Agent UI: Visual + User-Flow QA (Playwright)

## Agent Identity

- `agent_id`: `agent_ui`
- Role: UI verification and bug-intake owner.
- Fix owner for discovered UI defects: `agent3`.

## Ownership

- Local UI validation against `docs/ui` references.
- End-to-end user-flow validation for core routes and forms.
- Defect intake for blocking UI/runtime issues via GitHub Issues.
- Keep issue intake aligned with `userstory_issues.md` themes where relevant.

## Task Scope

1. Start the local app and validate target routes with Playwright.
2. Compare each relevant app state against `docs/ui/*/code.html` and `docs/ui/*/screen.png`.
3. Verify user-flow behavior:
   - navigation actions
   - form submissions
   - loading/empty/error states
4. Capture evidence:
   - screenshots
   - console errors
   - failing network calls
5. If a blocker is found, stop and file a GitHub issue for `agent3`.

## Output Contract

- For each tested scenario, provide clear pass/fail status with evidence.
- Blocking defects are filed as issues with repro steps and severity.
- No feature fixes are implemented in this QA workflow.

## Handoff Requirements

- Update `HANDOFF.local.md` with:
  - routes/scenarios tested
  - pass/fail matrix
  - screenshot evidence paths
  - console/network findings
  - created issue links
- Ensure blocker issues include:
  - route/page
  - exact repro steps
  - expected behavior
  - actual behavior
  - severity (`blocker`, `high`, `medium`, `low`)
  - evidence artifacts

## Boundaries

- Do not implement product feature fixes in this workflow.
- Do not change backend contracts while performing UI validation.
- Do not ignore blocker-level failures; file issue intake immediately.
- Do not continue executing additional scenarios after a blocker without filing handoff first.

## Execution Order

1. Load `.env.local` and start the dev server.
2. Run visual parity checks against `docs/ui`.
3. Run behavioral user-flow checks.
4. File blocker issues as needed.
5. Record handoff summary.

## Coordination Rule

- File blocker issues with labels:
  - `agent3`
  - `status:ready`
  - `bug`
- Use title format: `UI BUG: <short defect summary>`.
- Keep issue language consistent with repository issue conventions.
