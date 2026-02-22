import { describe, expect, it } from "vitest";
import {
  assignTasks,
  type MemberEffectiveSkills,
  type TaskForAssignment,
  type TaskSkillRequirement,
} from "@/lib/assignment/assign-tasks";

function makeTask(
  id: string,
  difficultyPoints: TaskForAssignment["difficultyPoints"] = 1,
): TaskForAssignment {
  return {
    id,
    status: "todo",
    difficultyPoints,
    assigneeUserId: null,
  };
}

describe("assignTasks", () => {
  it("caps load imbalance when a top-skilled member is already overloaded", () => {
    const tasks: TaskForAssignment[] = [makeTask("task-1", 1)];
    const members: MemberEffectiveSkills[] = [
      {
        userId: "member-a",
        skills: { backend: 5 },
        currentLoad: 4,
      },
      {
        userId: "member-b",
        skills: { backend: 0 },
        currentLoad: 0,
      },
    ];
    const requirements: TaskSkillRequirement[] = [
      {
        taskId: "task-1",
        skillId: "backend",
        weight: 3,
      },
    ];

    const result = assignTasks(tasks, members, requirements);

    expect(result.assignments).toEqual([
      {
        taskId: "task-1",
        assigneeUserId: "member-b",
      },
    ]);
  });

  it("still prefers stronger skill match when fairness window allows it", () => {
    const tasks: TaskForAssignment[] = [makeTask("task-1", 1)];
    const members: MemberEffectiveSkills[] = [
      {
        userId: "member-a",
        skills: { backend: 5 },
        currentLoad: 1,
      },
      {
        userId: "member-b",
        skills: { backend: 0 },
        currentLoad: 0,
      },
    ];
    const requirements: TaskSkillRequirement[] = [
      {
        taskId: "task-1",
        skillId: "backend",
        weight: 3,
      },
    ];

    const result = assignTasks(tasks, members, requirements);

    expect(result.assignments).toEqual([
      {
        taskId: "task-1",
        assigneeUserId: "member-a",
      },
    ]);
  });

  it("keeps broad assignment spreads bounded for many small tasks", () => {
    const tasks: TaskForAssignment[] = [
      makeTask("task-1"),
      makeTask("task-2"),
      makeTask("task-3"),
      makeTask("task-4"),
      makeTask("task-5"),
      makeTask("task-6"),
      makeTask("task-7"),
      makeTask("task-8"),
      makeTask("task-9"),
    ];
    const members: MemberEffectiveSkills[] = [
      {
        userId: "member-a",
        skills: { backend: 5 },
        currentLoad: 0,
      },
      {
        userId: "member-b",
        skills: { backend: 0 },
        currentLoad: 0,
      },
      {
        userId: "member-c",
        skills: { backend: 0 },
        currentLoad: 0,
      },
    ];
    const requirements: TaskSkillRequirement[] = tasks.map((task) => ({
      taskId: task.id,
      skillId: "backend",
      weight: 1,
    }));

    const result = assignTasks(tasks, members, requirements);
    const loadByMember = new Map<string, number>();
    for (const member of members) {
      loadByMember.set(member.userId, member.currentLoad);
    }
    for (const assignment of result.assignments) {
      const task = tasks.find(
        (candidate) => candidate.id === assignment.taskId,
      );
      if (!task) {
        continue;
      }
      loadByMember.set(
        assignment.assigneeUserId,
        (loadByMember.get(assignment.assigneeUserId) ?? 0) +
          task.difficultyPoints,
      );
    }

    const loads = [...loadByMember.values()];
    const spread = Math.max(...loads) - Math.min(...loads);

    expect(result.assignedCount).toBe(9);
    expect(spread).toBeLessThanOrEqual(2);
  });
});
