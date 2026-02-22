import type { TaskStatus } from "@/types/planning";

export type TaskSkillRequirement = {
  taskId: string;
  skillId: string;
  weight: number;
};

export type TaskForAssignment = {
  id: string;
  status: TaskStatus;
  difficultyPoints: 1 | 2 | 3 | 5 | 8;
  assigneeUserId: string | null;
};

export type MemberEffectiveSkills = {
  userId: string;
  skills: Record<string, number>;
  currentLoad: number;
};

export type AssignmentResult = {
  assignments: Array<{ taskId: string; assigneeUserId: string }>;
  assignedCount: number;
};

function maxAllowedProjectedLoadGap(task: TaskForAssignment): number {
  return Math.max(1, Math.floor(task.difficultyPoints / 2) + 1);
}

function scoreMemberForTask(
  member: MemberEffectiveSkills,
  task: TaskForAssignment,
  requirements: TaskSkillRequirement[],
): number {
  if (requirements.length === 0) {
    return 1 - member.currentLoad * 0.1;
  }

  const skillScore = requirements.reduce((acc, requirement) => {
    const level = member.skills[requirement.skillId] ?? 0;
    const normalized = level / 5;
    return acc + normalized * requirement.weight;
  }, 0);

  const workloadPenalty = member.currentLoad * 0.35;
  const difficultyBonus = 0.03 * task.difficultyPoints;
  return skillScore + difficultyBonus - workloadPenalty;
}

export function assignTasks(
  tasks: TaskForAssignment[],
  members: MemberEffectiveSkills[],
  taskRequirements: TaskSkillRequirement[],
): AssignmentResult {
  if (members.length === 0) {
    return { assignments: [], assignedCount: 0 };
  }

  const mutableMembers = members.map((member) => ({ ...member }));
  const eligibleTasks = tasks
    .filter((task) => task.assigneeUserId === null && task.status === "todo")
    .sort(
      (a, b) =>
        b.difficultyPoints - a.difficultyPoints || a.id.localeCompare(b.id),
    );
  const requirementsByTask = new Map<string, TaskSkillRequirement[]>();
  for (const requirement of taskRequirements) {
    const existing = requirementsByTask.get(requirement.taskId);
    if (existing) {
      existing.push(requirement);
      continue;
    }
    requirementsByTask.set(requirement.taskId, [requirement]);
  }

  const assignments: Array<{ taskId: string; assigneeUserId: string }> = [];

  for (const task of eligibleTasks) {
    const requirements = requirementsByTask.get(task.id) ?? [];

    const ranked = mutableMembers
      .map((member) => ({
        member,
        score: scoreMemberForTask(member, task, requirements),
        projectedLoad: member.currentLoad + task.difficultyPoints,
      }))
      .sort(
        (left, right) =>
          right.score - left.score ||
          left.projectedLoad - right.projectedLoad ||
          left.member.userId.localeCompare(right.member.userId),
      );

    const minProjectedLoad = ranked.reduce(
      (currentMin, candidate) => Math.min(currentMin, candidate.projectedLoad),
      Number.POSITIVE_INFINITY,
    );
    const fairCandidate = ranked.find(
      (candidate) =>
        candidate.projectedLoad - minProjectedLoad <=
        maxAllowedProjectedLoadGap(task),
    );
    const selected = fairCandidate ?? ranked[0];
    if (!selected) {
      continue;
    }

    assignments.push({
      taskId: task.id,
      assigneeUserId: selected.member.userId,
    });

    selected.member.currentLoad += task.difficultyPoints;
  }

  return {
    assignments,
    assignedCount: assignments.length,
  };
}
