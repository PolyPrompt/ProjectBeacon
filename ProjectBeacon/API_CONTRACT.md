# API Contract (MVP)

This document is the shared API contract across agents. Freeze request/response shapes here before heavy implementation.

## Contract Rules
- Use UTC ISO timestamps in responses.
- Use snake_case in DB, camelCase in API DTOs.
- Validate all payloads with Zod at API boundary.
- Return stable error format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human readable message",
    "details": {}
  }
}
```

- Auth-required endpoints must return `401` when unauthenticated.
- Permission failures must return `403`.

## Ownership Map
- Agent 1: foundation + CRUD endpoints
- Agent 2: AI/planning/assignment/replan/reassignment endpoints
- Agent 3: UI integration against frozen contracts

## Status Model
- Project planning status: `draft -> locked -> assigned`
- Task status: `todo | in_progress | blocked | done`

## Core Types

```ts
export type ProjectPlanningStatus = "draft" | "locked" | "assigned";
export type TaskStatus = "todo" | "in_progress" | "blocked" | "done";

export type ApiError = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};
```

## Agent 1 Contracts

## `POST /api/users/bootstrap`
Purpose: ensure local `users` row exists/updated from Clerk identity.

Request:
```json
{}
```

Response `200`:
```json
{
  "userId": "uuid",
  "clerkUserId": "clerk_123",
  "email": "student@school.edu",
  "created": true
}
```

## `POST /api/projects`
Request:
```json
{
  "name": "CS Capstone",
  "description": "Team project details",
  "deadline": "2026-03-20T00:00:00.000Z"
}
```

Response `201`:
```json
{
  "id": "p_123",
  "name": "CS Capstone",
  "description": "Team project details",
  "deadline": "2026-03-20T00:00:00.000Z",
  "ownerUserId": "uuid",
  "planningStatus": "draft"
}
```

## `GET /api/projects/:projectId`
Response `200`:
```json
{
  "id": "p_123",
  "name": "CS Capstone",
  "description": "Team project details",
  "deadline": "2026-03-20T00:00:00.000Z",
  "ownerUserId": "uuid",
  "planningStatus": "draft"
}
```

## `PATCH /api/projects/:projectId`
Request:
```json
{
  "name": "Updated Name",
  "description": "Updated details",
  "deadline": "2026-03-25T00:00:00.000Z"
}
```

Response `200`: same shape as `GET /api/projects/:projectId`.

## `GET /api/projects/:projectId/members`
Response `200`:
```json
{
  "members": [
    {
      "userId": "uuid",
      "name": "Ada Lovelace",
      "email": "ada@school.edu",
      "role": "owner"
    }
  ]
}
```

## `POST /api/projects/:projectId/members`
Request:
```json
{
  "userId": "uuid",
  "role": "member"
}
```

Response `201`:
```json
{
  "projectId": "p_123",
  "userId": "uuid",
  "role": "member"
}
```

## `GET /api/me/skills`
Response `200`:
```json
{
  "skills": [
    {
      "id": "us_001",
      "skillId": "s_react",
      "skillName": "React",
      "level": 4
    }
  ]
}
```

## `POST /api/me/skills`
Request:
```json
{
  "skillName": "React",
  "level": 4
}
```

Response `200`:
```json
{
  "id": "us_001",
  "skillId": "s_react",
  "skillName": "React",
  "level": 4
}
```

## `GET /api/projects/:projectId/skills`
Response `200`:
```json
{
  "skills": [
    {
      "userId": "uuid",
      "skillId": "s_react",
      "skillName": "React",
      "level": 4,
      "source": "project_override"
    }
  ]
}
```

## `POST /api/projects/:projectId/skills/import-profile`
Request:
```json
{
  "userId": "uuid"
}
```

Response `200`:
```json
{
  "imported": 4,
  "updated": 1
}
```

## `POST /api/projects/:projectId/documents`
Request: multipart upload flow or presigned upload finalize payload.

Response `201`:
```json
{
  "document": {
    "id": "doc_123",
    "projectId": "p_123",
    "fileName": "requirements.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 482193,
    "storageKey": "projects/p_123/docs/doc_123-requirements.pdf",
    "uploadedByUserId": "uuid",
    "createdAt": "2026-02-21T00:00:00.000Z"
  }
}
```

## Agent 2 Contracts

## `POST /api/projects/:projectId/context/confidence`
Response `200`:
```json
{
  "confidence": 72,
  "threshold": 85,
  "askedCount": 2,
  "maxQuestions": 5,
  "readyForGeneration": false
}
```

## `POST /api/projects/:projectId/context/clarify`
Response `200`:
```json
{
  "questions": [
    "What are the required deliverables?",
    "Which technologies are mandatory?"
  ]
}
```

## `POST /api/projects/:projectId/context/clarify-response`
Request:
```json
{
  "question": "What are the required deliverables?",
  "answer": "Web app, report, and demo video"
}
```

Response `200`:
```json
{
  "confidence": 84,
  "threshold": 85,
  "askedCount": 3,
  "maxQuestions": 5,
  "readyForGeneration": false
}
```

## `POST /api/projects/:projectId/ai/generate-tasks`
Behavior: generates draft task graph only; leaves assignees null.

Response `200`:
```json
{
  "tasks": [
    {
      "id": "t_123",
      "projectId": "p_123",
      "assigneeUserId": null,
      "title": "Build Auth Middleware",
      "description": "Implement protected route checks",
      "difficultyPoints": 3,
      "status": "todo",
      "dueAt": "2026-03-01T00:00:00.000Z",
      "createdAt": "2026-02-21T00:00:00.000Z",
      "updatedAt": "2026-02-21T00:00:00.000Z"
    }
  ],
  "taskSkills": [
    {
      "id": "ts_001",
      "taskId": "t_123",
      "skillId": "s_react",
      "weight": 4,
      "createdAt": "2026-02-21T00:00:00.000Z"
    }
  ],
  "taskDependencies": [
    {
      "id": "td_001",
      "taskId": "t_123",
      "dependsOnTaskId": "t_001"
    }
  ]
}
```

## `POST /api/projects/:projectId/planning/lock`
Response `200`:
```json
{
  "projectId": "p_123",
  "planningStatus": "locked"
}
```

## `POST /api/projects/:projectId/assignments/run`
Response `200`:
```json
{
  "projectId": "p_123",
  "planningStatus": "assigned",
  "assignedCount": 9
}
```

## `POST /api/projects/:projectId/replan`
Response `200`:
```json
{
  "projectId": "p_123",
  "updatedTasks": 4,
  "updatedDependencies": 3,
  "updatedTaskSkills": 5
}
```

## `POST /api/projects/:projectId/task-reassignment-requests`
Request:
```json
{
  "requestType": "swap",
  "taskId": "t_100",
  "counterpartyTaskId": "t_200",
  "toUserId": "uuid",
  "reason": "I can finish API faster; swap frontend tasks"
}
```

Response `201`:
```json
{
  "id": "rr_001",
  "status": "pending"
}
```

## `POST /api/task-reassignment-requests/:requestId/respond`
Request:
```json
{
  "action": "accept"
}
```

Response `200`:
```json
{
  "id": "rr_001",
  "status": "accepted"
}
```

## Agent 3 Integration Notes
- Build UI to these contracts; do not assume unstated fields.
- Gate generation on clarification readiness.
- Show planning state badges: `draft`, `locked`, `assigned`.
- Keep assignment controls disabled unless status allows action.

## Change Control
- Any contract change requires:
  1. Update this file first.
  2. Add entry to `DECISIONS.md` with rationale.
  3. Notify all agents in `HANDOFF.md`.
