export type MatchedSkill = {
  name: string;
  level: number;
};

export type AssignmentReasoningInput = {
  assigneeLabel: string | null;
  requiredSkillNames: string[];
  matchedSkills: MatchedSkill[];
  dependencyCount: number;
  difficultyPoints: number | null;
};

function formatMatchedSkills(skills: MatchedSkill[]): string {
  return skills.map((skill) => `${skill.name} (${skill.level}/5)`).join(", ");
}

export function buildAssignmentReasoning(
  input: AssignmentReasoningInput,
): string {
  const assignee = input.assigneeLabel ?? "the current assignee";

  if (!input.assigneeLabel) {
    return "Task is currently unassigned and awaiting assignment.";
  }

  if (input.requiredSkillNames.length === 0) {
    return `${assignee} was assigned based on workload balance and current project timing.`;
  }

  if (input.matchedSkills.length > 0) {
    const dependencyHint =
      input.dependencyCount > 0
        ? ` It also coordinates ${input.dependencyCount} prerequisite task${input.dependencyCount === 1 ? "" : "s"}.`
        : "";

    return `${assignee} was assigned due to strongest skill coverage in ${formatMatchedSkills(input.matchedSkills)}.${dependencyHint}`;
  }

  if (input.difficultyPoints) {
    return `${assignee} was assigned for workload balance and timeline fit on a difficulty ${input.difficultyPoints} task.`;
  }

  return `${assignee} was assigned based on workload balance and delivery sequencing.`;
}
