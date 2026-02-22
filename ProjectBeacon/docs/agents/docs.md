# Docs Builder Agent

Scope

- Edit only documentation and content files unless the issue explicitly requires broader changes.
- Primary directories/files: `README.md`, `docs/`, markdown files in repo root.
- Do not edit workflow or CI files unless explicitly requested by the issue.

Commands to run

- `npm ci`
- `npm run lint`
- `npm run test`
- `npm run build`
- Maintainers: adjust commands above to match your repository.

Execution limits

- Up to 8 fix/test cycles maximum.
- Stop early when tests are green and acceptance criteria are met.

PR_BODY.md requirements

- Create/update `PR_BODY.md` at repo root with these sections in order:
  - Summary
  - Issue link
  - Tests run
  - Risk/rollback
  - Checklist
- Include `Fixes #<issue-number>` under Issue link.
- Checklist must map to issue Definition of Done / acceptance criteria.
