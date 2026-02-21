# Post-Onboarding Role QA Matrix

Date (UTC): 2026-02-21T21:42:00Z  
Owner: `agent3`  
Scope: `PB-024` to `PB-029`

## Environment

- App run: `npm run dev` on `http://localhost:3000`
- Auth mode: local scaffold (`/sign-in`, cookie session)
- Roles tested:
  - `admin` (`pb_role=admin`)
  - `user` (`pb_role=user`)

## Matrix

| Page / Flow                                              | Admin                                                               | User                                       | Result                               |
| -------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------ |
| Dashboard nav access (`/projects/[projectId]`)           | visible + active                                                    | visible + active                           | Pass                                 |
| Documents nav access (`/projects/[projectId]/documents`) | visible + active                                                    | visible + active                           | Pass                                 |
| Board nav access (`/projects/[projectId]/board`)         | visible + active                                                    | visible + active                           | Pass                                 |
| Timeline nav access (`/projects/[projectId]/timeline`)   | visible + active                                                    | visible + active                           | Pass                                 |
| Settings nav access (`/projects/[projectId]/settings`)   | visible + active                                                    | visible + active                           | Pass                                 |
| Dashboard countdown cards + my tasks + team status       | rendered (scaffold payload)                                         | rendered (scaffold payload)                | Pass (Scaffold)                      |
| Dashboard task modal open (`my tasks row -> modal`)      | opens modal with detail fallback                                    | opens modal with detail fallback           | Pass (Scaffold)                      |
| Dashboard modal timeline deep-link (`Open in Timeline`)  | navigates to `/timeline?taskId=...`                                 | navigates to `/timeline?taskId=...`        | Pass                                 |
| Timeline selected-task highlight from deep-link          | query consumed; highlight only when task exists in timeline payload | same                                       | Partial (ID mismatch under scaffold) |
| Documents admin controls (upload/assign/remove)          | controls visible and action-attempt wired                           | hidden                                     | Pass                                 |
| Documents user read-only labeling                        | n/a                                                                 | read-only hint shown, no mutation controls | Pass                                 |
| Documents preview/embed from signed URL endpoint         | `/documents/:id/view` requested; modal handles 404 with error state | same                                       | Partial (endpoint unavailable)       |
| Settings member controls (share + leave)                 | visible                                                             | visible                                    | Pass                                 |
| Settings admin-only controls (edit/delete)               | visible                                                             | hidden with user-mode hint                 | Pass                                 |
| Delete confirmation safety (`DELETE` required)           | delete button disabled until exact confirm text                     | hidden                                     | Pass                                 |
| Board workflow rendering (one column per user)           | rendered                                                            | rendered                                   | Pass (Scaffold)                      |
| Workflow `Board <-> Timeline` switch control             | present + working                                                   | present + working                          | Pass                                 |
| Capability-driven affordance message                     | reflects API flag or role fallback                                  | reflects API flag or role fallback         | Pass (Scaffold)                      |

## Key Evidence

- Unauthenticated redirect validated: `/projects/demo-project/timeline?taskId=t_scaffold_1` redirected to `/sign-in?next=%2Fprojects%2Fdemo-project`.
- Dashboard modal deep-link validated: modal link navigated to `timeline?taskId=t_scaffold_1`.
- Documents preview endpoint validated for request path and error handling: `/api/projects/demo-project/documents/doc_scaffold_1/view` returned `404` and modal surfaced recoverable error.
- User permission checks validated in UI:
  - Documents page shows read-only mode and hides admin mutation controls.
  - Settings page hides admin section and shows user-mode hint.

## Regression / Follow-Up List

1. `PB-022`/`PB-023` integration: align dashboard modal `taskId` deep-link IDs with timeline payload IDs so selected-task highlight always works.
2. `PB-020` integration: implement `/api/projects/:projectId/documents/:documentId/view` signed URL response to enable real embed/download previews.
3. `PB-019` integration: finalize share/leave/update/delete settings endpoints to replace scaffold status messages.
4. Normalize workflow capability DTO shape across board/timeline endpoints to remove fallback inference logic.
5. Add stable end-to-end Playwright checks in CI for both roles once dependencies are merged.
