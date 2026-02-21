# ProjectBeacon Agent Guide

These rules override global defaults when they are more specific.

## Scope

- Applies to files under this directory (`ProjectBeacon/ProjectBeacon`) and its subdirectories.
- If a deeper subdirectory adds its own `AGENTS.md`, that file is more specific for files under that path.

## Repository Map (Read First)

- Git root: `../` (parent directory)
- Application root: `.` (this directory)
- Main Next.js app code: `./app` and `./src/app` (if used)
- Static assets: `./public`
- App config:
  - `./package.json`
  - `./tsconfig.json`
  - `./next.config.ts`
  - `./eslint.config.mjs`

Important: for this subtree, most product code changes should happen in this directory, not in the parent repo root.

## Working Directory Rules

- Before running Node/Next commands, change into app root:
  - `cd ProjectBeacon/ProjectBeacon`
- Run package manager commands from that app directory unless explicitly required otherwise.

## Agent Identity Guard

- Use `AGENT_ID` from environment to determine current role (`agent1`, `agent2`, or `agent3`).
- At the start of every new task/issue, verify `AGENT_ID` matches the assigned owner role before making changes.
- During long autonomous runs, re-check `AGENT_ID` at each task boundary (and at least once every hour) to prevent role drift.
- If `AGENT_ID` is missing/invalid or mismatched with task ownership, stop and report the mismatch in `HANDOFF.local.md`.

## Stack Snapshot

- Framework: Next.js `16.1.6`
- React: `19.2.3`
- Language: TypeScript `^5`
- Styling: Tailwind CSS `^4`
- Lint: ESLint `^9`
- Formatting: Prettier `^3`

## Standard Commands

From `.`:

```bash
npm install
npm run dev
npm run lint
npm run format:check
npm run format
npm run build
npm run start
```

## Supabase Table Creation

Use Supabase Management API only for schema changes. Do not use `supabase db push` in this repo.

1. Prepare SQL (optionally keep a matching file under `./supabase/migrations` for history), for example:

```sql
create table if not exists public.test_items (
  id bigint generated always as identity primary key,
  name text not null,
  notes text,
  created_at timestamptz not null default now()
);
```

2. Run SQL through Supabase Management API using `SUPABASE_ACCESS_TOKEN`:

```bash
ref="<your-project-ref>"
curl -sS "https://api.supabase.com/v1/projects/$ref/database/query" \
  -X POST \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"query":"create table if not exists public.test_items (id bigint generated always as identity primary key, name text not null, notes text, created_at timestamptz not null default now());"}'
```

3. Verify table exists (also via Management API SQL query):

```sql
select table_schema, table_name
from information_schema.tables
where table_schema = 'public' and table_name = 'test_items';
```

## Validation Strategy

- After each meaningful code change, run the smallest relevant check first.
- Preferred order:
  1. `npm run format:check` for formatting compliance
  2. `npm run lint` for code-quality/syntax issues
  3. `npm run build` for integration-level validation when changes are substantial
- There is currently no dedicated test script in `package.json`. If tests are added later, run nearest impacted tests first.
- If formatting fails, run `npm run format`, then re-run `npm run format:check`.

## Failure Handling

- If `npm run build` fails, iterate with minimal fixes and re-run checks.
- Process:
  1. Capture and report the first actionable error.
  2. Apply the smallest change that addresses that error.
  3. Run the quickest relevant check (for example `npm run format:check` or `npm run lint`) before retrying `npm run build`.
- Retry limit: maximum 3 build-fix iterations per task.
- Stop and ask the user when:
  - the same error persists after 2 attempts,
  - multiple root causes conflict,
  - the fix requires dependency upgrades, config rewrites, or broad refactors.
- Always include in handoff:
  - failing command,
  - key error snippet,
  - files changed,
  - latest command results.

## Change Boundaries

- Do not modify secrets or environment files (for example `.env*`) without explicit user instruction.
- Keep edits minimal and scoped to requested behavior.
- Avoid incidental refactors while implementing user-requested changes.
- Only update `package-lock.json` when dependencies are intentionally changed.

## Documentation Expectations

- If behavior, setup, or architecture changes, update:
  - `./README.md`
- Track current in-progress ownership and task scope in GitHub Issues/PRs:
  - each workstream must have an issue with assignee, status label, and dependency links
  - PRs must reference the issue (for example `Closes #123`)
  - if working locally without network access, record temporary notes in `./HANDOFF.local.md` until issue sync is possible
- Track active work and handoff notes in:
  - `./HANDOFF.local.md` (create if missing when relevant to active work)
- Keep a running major-decision log in:
  - `./DECISIONS.md` (create if missing)
- Log only meaningful decisions (for example architecture, dependency, scope, tradeoff, or risk decisions), each with:
  - date/time in UTC (ISO 8601, for example `2026-02-21T03:15:00Z`)
  - decision summary
  - rationale
  - alternatives considered
  - impact on files or behavior

## Context Handoff Policy

- When context becomes large (or before starting a new task), write a concise checkpoint to `./HANDOFF.local.md`.
- At minimum, include:
  - current issue/task ID
  - what is complete
  - what is in progress
  - blockers/assumptions
  - next concrete command/action
- During long autonomous runs, refresh `./HANDOFF.local.md` at least once per hour and at every task boundary.
- `./HANDOFF.local.md` is local-only and must remain gitignored.

## UI Reference Usage

- Visual/source reference files live in `./docs/ui` (images + html examples).
- Goal is to get close in layout, hierarchy, and interaction flow, not exact pixel-perfect parity.
- When conflicts exist, product/task requirements and API contracts take priority over UI reference.

How to use `./docs/ui`:
- Read relevant files in `./docs/ui` before implementing UI work.
- Preserve page structure, key components/states, and primary user flows.
- If reference includes out-of-scope features, omit or stub them.
- If required tasks are missing in reference, implement required behavior using the same visual language.
- Record intentional UI deviations in `./HANDOFF.local.md` with a brief reason.

Priority order for decisions:
1. `./tasks.md`
2. `./API_CONTRACT.md`
3. `./DATAMODEL.md`
4. `./docs/ui`

UI Definition of Done:
- Core layout/flow is close to `./docs/ui`.
- Required task behavior is implemented even where reference is incomplete.
- Loading, empty, and error states are handled.
- Remove hardcoded mock assumptions once corresponding API endpoint exists.

## Git and Review Hygiene

- Keep commits focused and small.
- Include file paths and concrete verification results in handoff summaries.
- If pre-existing unrelated modifications are present, do not revert them unless the user asks.
- Use a separate branch per issue/task; never work directly on `main`.
- Branch naming convention: `agent<id>/pb-<task-id>-<short-slug>` (for example `agent1/pb-004-project-create-api`).
- Keep branch scope to one task/issue when possible; if scope expands, open a new issue/branch.
- Before opening a PR, sync with latest `main` (rebase or merge) and rerun required checks.
