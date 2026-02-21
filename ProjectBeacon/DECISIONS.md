# Decision Log

## 2026-02-21T12:43:20Z - Use Hybrid Server/Client Dashboard Shell

- Decision summary: Build `/projects/[projectId]` as a server-loaded page for initial data hydration, then hand interactive planning flow to client components.
- Rationale: PB-015 requires server-component initial load while PB-016 requires interactive state transitions (clarify, generate, lock, assign).
- Alternatives considered:
  - Fully client-rendered dashboard: rejected because it would not satisfy the PB-015 server-load constraint.
  - Fully server-rendered flow: rejected because interactive multi-step workspace actions would be cumbersome and slower.
- Impact on files or behavior:
  - Added `app/projects/[projectId]/page.tsx`.
  - Added `components/dashboard/project-dashboard-shell.tsx`.

## 2026-02-21T12:43:20Z - Contract-First API Wiring with Local Fallback Scaffold

- Decision summary: Wire UI to frozen `API_CONTRACT.md` endpoints and provide local fallback state when endpoints are unavailable.
- Rationale: Agent3 must progress independently overnight while backend tickets may still be in-flight.
- Alternatives considered:
  - Block frontend until all endpoints exist: rejected because it stalls PB-015/PB-016 progress.
  - Invent extra endpoint fields/contracts: rejected per API contract guardrails.
- Impact on files or behavior:
  - Added workspace actions in `components/projects/planning-workspace.tsx` and `components/projects/clarification-panel.tsx`.
  - Added fallback task/document/context handling for offline/incomplete backend states.

## 2026-02-21T12:43:20Z - Map Context Editing to Project Description PATCH Until Context CRUD Stabilizes

- Decision summary: Use `PATCH /api/projects/:projectId` description updates as the persisted requirement text action, while mirroring context entries in local workspace state.
- Rationale: `API_CONTRACT.md` defines project update and clarification endpoints, but does not freeze a context CRUD response shape.
- Alternatives considered:
  - Introduce a new context endpoint shape locally: rejected to avoid contract drift.
  - Keep context text fully ephemeral only: rejected because it removes a persisted path.
- Impact on files or behavior:
  - Added `components/projects/context-editor.tsx` with PATCH integration + local context entry mirror.
  - Documented fallback behavior in `README.md` and handoff notes.

## 2026-02-21T13:02:56Z - Remove Undocumented Documents Read from Dashboard Boot

- Decision summary: Stop fetching `GET /api/projects/:projectId/documents` in server page load until a frozen read contract exists.
- Rationale: `API_CONTRACT.md` currently freezes document upload (`POST`) but does not define documents read shape; calling unstated endpoints risks contract drift.
- Alternatives considered:
  - Keep optimistic fetch against inferred read response: rejected because it assumes unstated backend behavior.
  - Invent a new read contract locally: rejected because API ownership is outside agent3 scope.
- Impact on files or behavior:
  - Updated `app/projects/[projectId]/page.tsx` to initialize documents with scaffold state instead of undocumented API fetch.

## 2026-02-21T13:02:56Z - Restrict Local Fallback to Unavailable/Network Paths

- Decision summary: Only trigger scaffold fallback when endpoints are unavailable (`404/405/501`) or network-failing, while preserving real API error visibility.
- Rationale: Broad fallback-on-any-error can hide backend validation/permission failures once APIs are live and creates misleading UI progression.
- Alternatives considered:
  - Keep fallback for all non-2xx responses: rejected because it masks actionable backend errors.
  - Disable fallback entirely: rejected because backend landing is still in-flight and blocks agent3 flow testing.
- Impact on files or behavior:
  - Updated `components/projects/context-editor.tsx`.
  - Updated `components/projects/clarification-panel.tsx`.
  - Updated `components/projects/planning-workspace.tsx`.

## 2026-02-21T13:02:56Z - Replace Remote Google Font Loading with Local Font Stacks

- Decision summary: Remove `next/font/google` usage in app layouts and switch to local CSS font stacks.
- Rationale: This runtime blocks outbound font fetches, and build reliability is required for overnight autonomous execution.
- Alternatives considered:
  - Keep Google font integration and accept build instability: rejected.
  - Add local font files and `next/font/local`: deferred for now to keep changes minimal and avoid asset management churn.
- Impact on files or behavior:
  - Updated `app/layout.tsx` and `src/app/layout.tsx`.
  - Updated `app/globals.css` and `src/app/globals.css`.

## 2026-02-21T19:20:54Z - Convert Workspace Flow from Single Section to Route-Based Steps

- Decision summary: Move workspace flow from one dashboard section into dedicated routes for each stage (`context`, `clarify`, `generate`, `review`, `lock`, `assign`).
- Rationale: Current requirement explicitly asks for individual pages for the sequence `context + docs -> clarify -> generate draft -> review -> lock -> assign` and UI references are page-oriented.
- Alternatives considered:
  - Keep one in-page wizard section: rejected because it does not satisfy the individual-pages requirement.
  - Keep only three coarse pages (`intake`, `clarify`, `review`): rejected because it compresses lock/assign into one stage and reduces milestone clarity.
- Impact on files or behavior:
  - Added route set under `app/projects/[projectId]/workspace/*`.
  - Updated `app/projects/[projectId]/page.tsx` to act as dashboard entry rather than embedded workflow executor.

## 2026-02-21T19:20:54Z - Persist Cross-Page Draft State in Local Workspace Store

- Decision summary: Introduce a client-side workspace draft store (localStorage-backed) to keep context/docs/clarification/tasks/dependencies/planning status synchronized across step pages.
- Rationale: With backend endpoints still partially in-flight and no frozen read APIs for all draft entities, route transitions would otherwise lose generated/edit state.
- Alternatives considered:
  - Keep state only in component memory per page: rejected because navigation between pages would reset flow state.
  - Require backend read/write coverage for every step before UI progression: rejected because it would block agent3 overnight progress.
- Impact on files or behavior:
  - Added `lib/workspace/draft-store.ts` with contract-safe API fallback behavior.
  - Added shared server fetch helpers in `lib/workspace/page-data.ts` and `lib/workspace/fetch-contract.ts`.
