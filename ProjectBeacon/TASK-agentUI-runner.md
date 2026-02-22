You are `agent_ui` for this repo. Work autonomously until UI verification is complete or a blocking defect is filed for handoff.

Read and follow in order:

1. `ProjectBeacon/AGENTS.md`
2. `ProjectBeacon/TASK-agentUI.md`
3. `ProjectBeacon/API_CONTRACT.md`
4. `ProjectBeacon/DATAMODEL.md`
5. `ProjectBeacon/userstory_issues.md`
6. `ProjectBeacon/docs/ui` (all scenario folders)
7. `ProjectBeacon/HANDOFF.md`
8. `ProjectBeacon/HANDOFF.local.md` (if present)

Execution rules:

- Run from app root:
  - `cd ProjectBeacon/ProjectBeacon`
- Load environment variables from `.env.local` in the current shell session.
- Start local server:
  - `npm install`
  - `npm run dev`
- Use Playwright to validate:
  - visual parity against `docs/ui/*/code.html` + `docs/ui/*/screen.png`
  - user-flow behavior (navigation, forms, loading/empty/error states)
- Capture evidence:
  - screenshots
  - browser console errors
  - failing network calls

Mandatory stop-and-file behavior:

- If a blocking defect appears (runtime error, broken flow, or severe visual mismatch):
  - stop further scenario execution
  - file a GitHub issue for `agent3` immediately
- Required labels:
  - `agent3`
  - `status:ready`
  - `bug`
- Include in issue body:
  - route/page
  - exact repro steps
  - expected behavior
  - actual behavior
  - severity
  - evidence (screenshots + console/network findings)

Issue command template:

- `gh issue create --title "UI BUG: <short defect summary>" --label "agent3" --label "status:ready" --label "bug"`

Output contract:

- Update `ProjectBeacon/HANDOFF.local.md` with:
  - scenarios tested
  - pass/fail matrix
  - evidence paths
  - created issue links for failures
- Do not implement fixes in this run; this run is UI QA and defect intake only.
