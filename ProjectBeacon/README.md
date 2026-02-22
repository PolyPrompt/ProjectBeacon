# Project Beacon (Group Project Task Delegator)

Project Beacon is a web platform that helps student teams split group projects fairly using AI.  
It turns a project specification into structured tasks with difficulty scores, dependencies, and timeline suggestions, then assigns work based on skills and workload balance.

## Problem Statement

College group projects, especially in Computer Science, are often unbalanced and poorly coordinated:

- task assignment is informal and uneven
- strong members get overloaded while others are underutilized
- dependencies and deadlines are unclear
- teams lack progress visibility and accountability
- professors have limited insight into team process

## Solution

Project Beacon uses AI to:

- ask clarifying questions until project requirements are well understood
- split specifications into 6-12 actionable tasks
- score task difficulty (1-10) and estimate time
- identify required skills for each task
- model task dependencies
- assign tasks fairly based on skills and difficulty distribution
- generate team and personal timelines toward the deadline
- re-plan tasks when requirements change

V0 focuses on Computer Science projects, with a future path to all subjects.

## Target Users

- primary: college students in group projects
- future: professors/instructors who want project visibility and end-of-project peer review signals

## Core Features (Student Side)

### Authentication and Profiles

- login with Google, Microsoft, or email/password
- create profile and manually add skills
- optional resume upload for AI skill inference (nice to have)

### Project Management

- create a project
- invite team members
- join via invite link or code
- set deadline and project specs
- update tasks when requirements change
- view assigned tasks and dependency-aware personal timeline

### AI Task Delegation

- requirement intake with clarifying questions
- structured task generation in JSON format
- difficulty + effort scoring
- dependency graph construction
- balanced assignment based on skill fit and workload
- optional help text per task (how to start, first steps, ideas)

### Timeline and Notifications

- timeline generation based on deadline and dependencies
- personal view of blocked/unblocked tasks
- upcoming task notifications via email
- calendar/scheduling integration (planned, including Timeful)

## Nice-to-Have Scope

- professor dashboard for project oversight
- professor-assisted group formation
- anonymous peer review visible to professor at end of project
- central workspace for project documents
- broaden beyond C.S. into general academic project support

## High-Level System Design

- clients: web
- backend: API service (can be within Next.js or separate service)
- data: relational DB + object storage
- auth: OAuth + email/password
- external services: AI model API, email provider, scheduling/time service
- async processing: queue + workers (for heavy AI/task generation jobs)
- hosting direction: Vercel for Next.js, optional Render/AWS for dedicated backend workers

## Tech Direction

- frontend: Next.js + TypeScript
- backend: Next.js API routes or separate service if needed
- auth: Clerk/Auth provider + OAuth
- scheduling/time: Timeful (planned)
- deployment: Vercel-first

## Team Resources

- YouTube updates:
  - https://youtu.be/MPfOhJs-EKc?si=aWGNYsh3pQsWjOCJ
  - https://youtu.be/k00WsEPDmrU?si=hmNiZCGFgju_LdeL
  - https://youtu.be/l0hVIH3EnlQ?si=bTn0DbOM6fI9329v
  - https://youtu.be/JWxcEL4mg_Q?si=I4EGQ_eF91kl6wRh
- Ethics reference:
  - https://drive.google.com/file/d/1gN3yuNgqrpto7c_VTym2bfCv-kqHWeKp/view?usp=drive_link
- Diagram reference:
  - https://drive.google.com/file/d/1FkjmI2m7BAVpJkLRp-pu1RMuUpWDXlQj/view?usp=sharing

## Getting Started

Install dependencies and run locally:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

### Auth Environment

Copy `.env.example` to `.env.local` and set Clerk keys:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL` (default `/sign-in`)
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL` (default `/sign-up`)

### Route Protection

- `/projects/**` requires an authenticated Clerk session and redirects unauthenticated users to sign-in.
- `/api/**` requires authentication by default.
- Public API exceptions are limited to `/api/public/**` and `/api/health/**`.

### Playwright E2E

Run the regression suite:

```bash
npm run test:e2e
```

Optional headed mode:

```bash
npm run test:e2e:headed
```

Artifacts:

- HTML report: `playwright-report/`
- traces/videos/screenshots: `test-results/playwright/`

Notes:

- The Playwright web server runs with `E2E_BYPASS_AUTH=true` so route-level tests can execute deterministically without external Clerk session setup.
- E2E specs use route-level API mocks for stable, non-flaky UI flow assertions.

## Planning Pipeline APIs (Agent 2)

The backend now includes MVP planning endpoints for the AI workflow:

- `POST /api/projects/:projectId/context/confidence`
- `POST /api/projects/:projectId/context/clarify`
- `POST /api/projects/:projectId/context/clarify-response`
- `POST /api/projects/:projectId/ai/generate-tasks`
- `POST /api/projects/:projectId/planning/lock`
- `POST /api/projects/:projectId/assignments/run`
- `POST /api/projects/:projectId/replan`
- `POST /api/projects/:projectId/task-reassignment-requests`
- `POST /api/task-reassignment-requests/:requestId/respond`

Status transitions are deterministic and enforced server-side:

- `draft -> locked -> assigned`

Dependency edges are cycle-validated on generation and replan.

Low-confidence planning behavior:

- `POST /api/projects/:projectId/ai/generate-tasks` accepts optional `{ "allowLowConfidenceProceed": true }`.
- When confidence is below threshold and low-confidence proceed is enabled, generation runs in provisional mode.
- Provisional mode is intended to produce discovery/research + re-planning tasks first, then refine after confidence is recomputed from updated context.

## Local Auth Convention

Server components and route handlers should read auth from Clerk helpers (`@clerk/nextjs/server`) or shared wrappers in `lib/auth/clerk-auth.ts`. Avoid ad-hoc header-based auth.

Project routes under `/projects/[projectId]` resolve the current actor from Clerk session plus `users` table mapping, then derive role capability (`admin|user`) from `project_members`.

Legacy helpers in `lib/auth/session.ts` for `pb_*` local cookies remain only as deprecated no-op compatibility exports and are not part of runtime auth.

## Post-Onboarding App Shell (PB-024)

Routes under `/projects/[projectId]` now share a common shell with exactly five navigation buttons:

- `Dashboard`
- `Documents`
- `Board`
- `Timeline`
- `Settings`

The shell includes role badge display, sign-out control, desktop top-nav, and mobile bottom-nav.

## Multi-Agent GitHub Automation

This repo includes scheduled Codex builder agents and a PR reviewer agent:

- Builders: `agent1`, `agent2`, `agent3`
- Reviewer: `reviewer`
- Workflows are in `.github/workflows/agent-*.yml`

### Required GitHub Settings

- Actions permissions must allow write access for `GITHUB_TOKEN` (contents, pull requests, issues).
- Repository settings should allow GitHub Actions to create and approve pull requests if your policy requires explicit enablement.
- Add secret `OPENAI_API_KEY` for `openai/codex-action@v1`.

### Required Labels

Create these labels exactly:

- `status:ready`
- `agent1`
- `agent2`
- `agent3`

### Issue Dependency Format

Builder agents only pick issues that are:

- Open
- Labeled `agent:<name>` and `status:ready`
- Dependency-ready

Dependencies are parsed from a single issue-body line:

```text
deps: #123 #456
```

Each listed dependency must be closed before the issue is eligible.

### Self-Hosted Runner Labels

Workflows are currently pinned to self-hosted runners and do not fall back to GitHub-hosted runners. Ensure your runner has these labels:

- `self-hosted`
- `macOS`
- `X64`
