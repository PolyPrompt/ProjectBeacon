"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type UserSkill = {
  id: string;
  skillId: string;
  skillName: string;
  level: number;
};

type SuggestedSkillGroup = {
  groupName: string;
  skills: string[];
};

const REQUIRED_SKILL_COUNT = 8;

const SUGGESTED_GROUPS: SuggestedSkillGroup[] = [
  {
    groupName: "Core Backend",
    skills: ["Node.js", "Docker", "Redis"],
  },
  {
    groupName: "AI & Data",
    skills: ["PyTorch", "Pandas", "Scikit-learn"],
  },
  {
    groupName: "Engineering Tools",
    skills: ["Git", "Kubernetes", "CI/CD"],
  },
];

const SOFT_SKILL_SUGGESTIONS = [
  "Communication",
  "Collaboration",
  "Leadership",
  "Technical Writing",
  "Team Leadership",
  "Project Management",
  "Mentoring",
  "Problem Solving",
  "Adaptability",
  "Time Management",
  "Conflict Resolution",
];

const SOFT_SKILLS = new Set(
  SOFT_SKILL_SUGGESTIONS.map((skillName) => skillName.trim().toLowerCase()),
);

const SOFT_SKILL_KEYWORDS = [
  "communication",
  "collaboration",
  "lead",
  "mentor",
  "coach",
  "facilitat",
  "project management",
  "time management",
  "conflict",
  "adapt",
  "problem solving",
  "critical thinking",
  "decision making",
  "stakeholder",
  "interpersonal",
  "empathy",
  "negotiat",
  "presentation",
  "teamwork",
];

function normalizeSkillName(value: string): string {
  return value.trim().toLowerCase();
}

function levelToLabel(level: number): string {
  switch (level) {
    case 1:
      return "Beginner";
    case 2:
      return "Foundational";
    case 3:
      return "Intermediate";
    case 4:
      return "Advanced";
    default:
      return "Expert";
  }
}

function isSoftSkill(skillName: string): boolean {
  const normalizedSkillName = normalizeSkillName(skillName);

  if (SOFT_SKILLS.has(normalizedSkillName)) {
    return true;
  }

  return SOFT_SKILL_KEYWORDS.some((keyword) =>
    normalizedSkillName.includes(keyword),
  );
}

function SkillLevelBar({
  level,
  onLevelChange,
}: {
  level: number;
  onLevelChange?: (nextLevel: number) => void;
}) {
  return (
    <div className="mt-2 grid grid-cols-5 gap-1">
      {Array.from({ length: 5 }).map((_, index) => {
        const isActive = index < level;
        const nextLevel = index + 1;
        return (
          <button
            key={index}
            type="button"
            className={`h-1.5 cursor-pointer rounded transition-colors duration-100 ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-300 ${
              isActive
                ? "bg-violet-500 hover:bg-violet-400"
                : "bg-slate-700 hover:bg-violet-500/35"
            }`}
            onClick={() => {
              if (!onLevelChange || nextLevel === level) {
                return;
              }

              onLevelChange(nextLevel);
            }}
            aria-label={`Set level ${nextLevel}`}
          />
        );
      })}
    </div>
  );
}

export function SkillsEditor({
  apiBasePath = "/api/me/skills",
  continueHref = "/projects/new",
}: {
  apiBasePath?: string;
  continueHref?: string;
}) {
  const router = useRouter();
  const [skills, setSkills] = useState<UserSkill[]>([]);
  const [manualSkillName, setManualSkillName] = useState("");
  const [manualLevel, setManualLevel] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadSkills = useCallback(async () => {
    setIsLoading(true);
    const response = await fetch(apiBasePath, { cache: "no-store" });
    const data = await response.json();

    if (!response.ok) {
      setError(data?.error?.message ?? "Failed to load skills");
      setIsLoading(false);
      return;
    }

    setSkills(data.skills ?? []);
    setIsLoading(false);
  }, [apiBasePath]);

  useEffect(() => {
    void loadSkills();
  }, [loadSkills]);

  const completionPercent = useMemo(
    () =>
      Math.min(100, Math.round((skills.length / REQUIRED_SKILL_COUNT) * 100)),
    [skills.length],
  );
  const isReadyToContinue = skills.length >= REQUIRED_SKILL_COUNT;

  const normalizedSkillNames = useMemo(
    () => new Set(skills.map((skill) => normalizeSkillName(skill.skillName))),
    [skills],
  );

  const hardSkills = useMemo(
    () =>
      skills
        .filter((skill) => !isSoftSkill(skill.skillName))
        .sort((a, b) => a.skillName.localeCompare(b.skillName)),
    [skills],
  );
  const softSkills = useMemo(
    () =>
      skills
        .filter((skill) => isSoftSkill(skill.skillName))
        .sort((a, b) => a.skillName.localeCompare(b.skillName)),
    [skills],
  );

  async function saveSkill(input: { skillName: string; level: number }) {
    const normalizedName = normalizeSkillName(input.skillName);
    if (!normalizedName) {
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      const response = await fetch(apiBasePath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skillName: input.skillName.trim(),
          level: input.level,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data?.error?.message ?? "Failed to save skill");
        return;
      }

      setSkills((previous) => {
        const withoutDuplicate = previous.filter(
          (item) => normalizeSkillName(item.skillName) !== normalizedName,
        );
        return [...withoutDuplicate, data];
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function addManualSkill(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await saveSkill({
      skillName: manualSkillName,
      level: manualLevel,
    });
    setManualSkillName("");
    setManualLevel(3);
  }

  async function addSuggestedSkill(skillName: string) {
    if (normalizedSkillNames.has(normalizeSkillName(skillName))) {
      return;
    }

    await saveSkill({
      skillName,
      level: 3,
    });
  }

  async function updateSkillLevel(id: string, nextLevel: number) {
    setError(null);
    let previousLevel: number | null = null;

    setSkills((previous) =>
      previous.map((skill) => {
        if (skill.id !== id) {
          return skill;
        }

        previousLevel = skill.level;
        return { ...skill, level: nextLevel };
      }),
    );

    const response = await fetch(apiBasePath, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, level: nextLevel }),
    });

    const data = await response.json();
    if (!response.ok) {
      setError(data?.error?.message ?? "Failed to update skill");
      if (previousLevel !== null) {
        setSkills((previous) =>
          previous.map((skill) =>
            skill.id === id
              ? { ...skill, level: previousLevel as number }
              : skill,
          ),
        );
      }
      return;
    }
  }

  async function removeSkill(id: string) {
    setError(null);

    const response = await fetch(apiBasePath, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    const data = await response.json();
    if (!response.ok) {
      setError(data?.error?.message ?? "Failed to delete skill");
      return;
    }

    setSkills((previous) => previous.filter((skill) => skill.id !== id));
  }

  return (
    <section className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-12">
        <section className="rounded-2xl border border-violet-500/30 bg-[#1a1426] p-5 lg:col-span-4">
          <h2 className="text-lg font-bold text-white">Add Manually</h2>
          <form className="mt-4 space-y-3" onSubmit={addManualSkill}>
            <input
              className="w-full rounded-lg border border-violet-500/30 bg-[#120f1b] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-400 focus:outline-none"
              placeholder="Search skills (e.g. AWS, Figma...)"
              value={manualSkillName}
              onChange={(event) => setManualSkillName(event.target.value)}
              required
            />
            <div className="flex gap-2">
              <select
                className="cursor-pointer rounded-lg border border-violet-500/30 bg-[#120f1b] px-3 py-2 text-sm text-slate-100 hover:cursor-pointer active:cursor-pointer"
                value={manualLevel}
                onChange={(event) => setManualLevel(Number(event.target.value))}
              >
                {[1, 2, 3, 4, 5].map((value) => (
                  <option key={value} value={value}>
                    Level {value}
                  </option>
                ))}
              </select>
              <button
                className="cursor-pointer rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:cursor-pointer hover:bg-violet-500 active:cursor-pointer disabled:cursor-default disabled:opacity-50"
                type="submit"
                disabled={isSaving}
              >
                Add
              </button>
            </div>
          </form>

          <div className="mt-6 space-y-5">
            <h3 className="text-base font-bold text-white">Suggestions</h3>
            {SUGGESTED_GROUPS.map((group) => (
              <div key={group.groupName} className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  {group.groupName}
                </p>
                <ul className="space-y-2">
                  {group.skills.map((skillName) => {
                    const isAdded = normalizedSkillNames.has(
                      normalizeSkillName(skillName),
                    );
                    const isDisabled = isSaving || isAdded;
                    return (
                      <li key={skillName}>
                        <button
                          type="button"
                          className={`flex w-full cursor-pointer items-center justify-between rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-2 text-left text-sm text-slate-100 transition hover:border-violet-400/50 hover:bg-violet-500/15 disabled:opacity-50 ${
                            isAdded
                              ? "disabled:cursor-not-allowed"
                              : "disabled:cursor-default"
                          }`}
                          onClick={() => void addSuggestedSkill(skillName)}
                          disabled={isDisabled}
                        >
                          <span>{skillName}</span>
                          <span className="text-violet-300">
                            {isAdded ? "Added" : "+"}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            <div className="space-y-2 border-t border-violet-500/20 pt-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                Soft Skills
              </p>
              <ul className="space-y-2">
                {SOFT_SKILL_SUGGESTIONS.map((skillName) => {
                  const isAdded = normalizedSkillNames.has(
                    normalizeSkillName(skillName),
                  );
                  const isDisabled = isSaving || isAdded;
                  return (
                    <li key={skillName}>
                      <button
                        type="button"
                        className={`flex w-full cursor-pointer items-center justify-between rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-2 text-left text-sm text-slate-100 transition hover:border-violet-400/50 hover:bg-violet-500/15 disabled:opacity-50 ${
                          isAdded
                            ? "disabled:cursor-not-allowed"
                            : "disabled:cursor-default"
                        }`}
                        onClick={() => void addSuggestedSkill(skillName)}
                        disabled={isDisabled}
                      >
                        <span>{skillName}</span>
                        <span className="text-violet-300">
                          {isAdded ? "Added" : "+"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-violet-500/30 bg-[#1a1426] p-6 lg:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-bold text-white">Skill Proficiency</h2>
            <span className="rounded-full bg-violet-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-violet-200">
              {skills.length}/{REQUIRED_SKILL_COUNT} skills added
            </span>
          </div>

          {isLoading ? (
            <p className="mt-6 rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-2 text-sm text-slate-300">
              Loading skill profile...
            </p>
          ) : null}

          {!isLoading && skills.length === 0 ? (
            <p className="mt-6 rounded-lg border border-dashed border-violet-500/30 bg-violet-500/5 px-3 py-2 text-sm text-slate-300">
              Add skills manually or use suggestions to start building your
              profile.
            </p>
          ) : null}

          {!isLoading && skills.length > 0 ? (
            <div className="mt-6 space-y-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">
                  Hard Skills
                </p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {hardSkills.map((skill) => (
                    <article
                      key={skill.id}
                      className="rounded-lg bg-[#120f1b] p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-slate-100">
                          {skill.skillName}
                        </p>
                        <span className="rounded bg-violet-500/20 px-2 py-0.5 text-xs font-semibold text-violet-200">
                          {levelToLabel(skill.level)}
                        </span>
                      </div>
                      <SkillLevelBar
                        level={skill.level}
                        onLevelChange={(nextLevel) =>
                          void updateSkillLevel(skill.id, nextLevel)
                        }
                      />
                      <div className="mt-2 flex items-center gap-2">
                        <select
                          className="cursor-pointer rounded border border-violet-500/30 bg-[#1b1629] px-2 py-1 text-xs text-slate-100 hover:cursor-pointer active:cursor-pointer"
                          value={skill.level}
                          onChange={(event) =>
                            void updateSkillLevel(
                              skill.id,
                              Number(event.target.value),
                            )
                          }
                        >
                          {[1, 2, 3, 4, 5].map((value) => (
                            <option key={value} value={value}>
                              {value}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="cursor-pointer text-xs text-red-300 hover:cursor-pointer hover:text-red-200 active:cursor-pointer"
                          onClick={() => void removeSkill(skill.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">
                  Soft Skills
                </p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {softSkills.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-violet-500/20 bg-violet-500/5 px-3 py-2 text-sm text-slate-300 md:col-span-2">
                      No soft skills added yet.
                    </p>
                  ) : (
                    softSkills.map((skill) => (
                      <article
                        key={skill.id}
                        className="rounded-lg bg-[#120f1b] p-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium text-slate-100">
                            {skill.skillName}
                          </p>
                          <span className="rounded bg-violet-500/20 px-2 py-0.5 text-xs font-semibold text-violet-200">
                            {levelToLabel(skill.level)}
                          </span>
                        </div>
                        <SkillLevelBar
                          level={skill.level}
                          onLevelChange={(nextLevel) =>
                            void updateSkillLevel(skill.id, nextLevel)
                          }
                        />
                        <div className="mt-2 flex items-center gap-2">
                          <select
                            className="cursor-pointer rounded border border-violet-500/30 bg-[#1b1629] px-2 py-1 text-xs text-slate-100 hover:cursor-pointer active:cursor-pointer"
                            value={skill.level}
                            onChange={(event) =>
                              void updateSkillLevel(
                                skill.id,
                                Number(event.target.value),
                              )
                            }
                          >
                            {[1, 2, 3, 4, 5].map((value) => (
                              <option key={value} value={value}>
                                {value}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="cursor-pointer text-xs text-red-300 hover:cursor-pointer hover:text-red-200 active:cursor-pointer"
                            onClick={() => void removeSkill(skill.id)}
                          >
                            Remove
                          </button>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : null}

          <section className="mt-8 rounded-xl border border-violet-500/30 bg-violet-500/10 p-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-slate-100">
                  Profile Completion
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  Add at least {REQUIRED_SKILL_COUNT} skills to unlock
                  AI-powered project matching.
                </p>
              </div>
              <p className="text-xl font-black text-violet-200">
                {completionPercent}%
              </p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-violet-500/20">
              <div
                className="h-full bg-violet-500 transition-all"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className="cursor-pointer rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition hover:cursor-pointer hover:bg-violet-500 active:cursor-pointer disabled:cursor-default disabled:bg-violet-900/60 disabled:text-violet-200/70"
                disabled={!isReadyToContinue || isSaving}
                onClick={() => router.push(continueHref)}
              >
                Continue to adding project documents
              </button>
            </div>
          </section>
        </section>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}
    </section>
  );
}
