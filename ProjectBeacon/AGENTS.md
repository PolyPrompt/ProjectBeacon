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
  - `cd ProjectBeacon/ProjectBeacon` (from `/Users/brandoneng/Desktop/Beacon`)
- Run package manager commands from that app directory unless explicitly required otherwise.

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
- Track current in-progress ownership and task scope in:
  - `./TASK.md` (create if missing)
- `./TASK.md` usage rules:
  - add/update a short entry at start of work with agent identifier, UTC start time, task summary, and target files
  - update the same entry when scope changes
  - mark status at end (`done`, `blocked`, or `handoff`)
- Track active work and handoff notes in:
  - `./HANDOFF.md` (create if missing when relevant to active work)
- Keep a running major-decision log in:
  - `./DECISIONS.md` (create if missing)
- Log only meaningful decisions (for example architecture, dependency, scope, tradeoff, or risk decisions), each with:
  - date/time in UTC (ISO 8601, for example `2026-02-21T03:15:00Z`)
  - decision summary
  - rationale
  - alternatives considered
  - impact on files or behavior

## Git and Review Hygiene

- Keep commits focused and small.
- Include file paths and concrete verification results in handoff summaries.
- If pre-existing unrelated modifications are present, do not revert them unless the user asks.
