"use client";

import { useCallback, useEffect, useState } from "react";

type UserSkill = {
  id: string;
  skillId: string;
  skillName: string;
  level: number;
};

export function SkillsEditor() {
  const [skills, setSkills] = useState<UserSkill[]>([]);
  const [skillName, setSkillName] = useState("");
  const [level, setLevel] = useState(3);
  const [error, setError] = useState<string | null>(null);

  const loadSkills = useCallback(async () => {
    const response = await fetch("/api/me/skills");
    const data = await response.json();

    if (!response.ok) {
      setError(data?.error?.message ?? "Failed to load skills");
      return;
    }

    setSkills(data.skills ?? []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSkills();
  }, [loadSkills]);

  async function addSkill(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const response = await fetch("/api/me/skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skillName, level }),
    });

    const data = await response.json();

    if (!response.ok) {
      setError(data?.error?.message ?? "Failed to save skill");
      return;
    }

    setSkillName("");
    setLevel(3);
    await loadSkills();
  }

  async function updateSkillLevel(id: string, nextLevel: number) {
    const response = await fetch("/api/me/skills", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, level: nextLevel }),
    });

    if (response.ok) {
      await loadSkills();
      return;
    }

    const data = await response.json();
    setError(data?.error?.message ?? "Failed to update skill");
  }

  async function removeSkill(id: string) {
    const response = await fetch("/api/me/skills", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    if (response.ok) {
      await loadSkills();
      return;
    }

    const data = await response.json();
    setError(data?.error?.message ?? "Failed to delete skill");
  }

  return (
    <section className="space-y-4 rounded border border-black/10 bg-white p-6">
      <h2 className="text-xl font-semibold">Profile Skills</h2>
      <form
        className="grid gap-3 sm:grid-cols-[1fr_120px_auto]"
        onSubmit={addSkill}
      >
        <input
          className="rounded border border-black/20 px-3 py-2"
          placeholder="Skill name"
          value={skillName}
          onChange={(event) => setSkillName(event.target.value)}
          required
        />
        <select
          className="rounded border border-black/20 px-3 py-2"
          value={level}
          onChange={(event) => setLevel(Number(event.target.value))}
        >
          {[1, 2, 3, 4, 5].map((value) => (
            <option key={value} value={value}>
              Level {value}
            </option>
          ))}
        </select>
        <button className="rounded bg-black px-4 py-2 text-white" type="submit">
          Save
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <ul className="space-y-2">
        {skills.map((skill) => (
          <li
            key={skill.id}
            className="flex flex-wrap items-center gap-3 rounded border border-black/10 p-3"
          >
            <span className="min-w-32 font-medium">{skill.skillName}</span>
            <select
              className="rounded border border-black/20 px-2 py-1"
              value={skill.level}
              onChange={(event) =>
                updateSkillLevel(skill.id, Number(event.target.value))
              }
            >
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <button
              className="text-sm text-red-600"
              type="button"
              onClick={() => removeSkill(skill.id)}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
