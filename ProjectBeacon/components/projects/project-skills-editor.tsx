"use client";

import { useCallback, useEffect, useState } from "react";

type EffectiveProjectSkill = {
  userId: string;
  skillId: string;
  skillName: string;
  level: number;
  source: "project_override" | "profile";
};

export function ProjectSkillsEditor({ projectId }: { projectId: string }) {
  const [skills, setSkills] = useState<EffectiveProjectSkill[]>([]);
  const [skillName, setSkillName] = useState("");
  const [level, setLevel] = useState(3);
  const [error, setError] = useState<string | null>(null);

  const loadSkills = useCallback(async () => {
    const response = await fetch(`/api/projects/${projectId}/skills`);
    const data = await response.json();

    if (!response.ok) {
      setError(data?.error?.message ?? "Failed to load project skills");
      return;
    }

    setSkills(data.skills ?? []);
  }, [projectId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSkills();
  }, [loadSkills]);

  async function importFromProfile() {
    setError(null);

    const response = await fetch(
      `/api/projects/${projectId}/skills/import-profile`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    );

    if (!response.ok) {
      const data = await response.json();
      setError(data?.error?.message ?? "Failed to import profile skills");
      return;
    }

    await loadSkills();
  }

  async function addProjectSkill(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const response = await fetch(`/api/projects/${projectId}/skills`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skillName, level }),
    });

    if (!response.ok) {
      const data = await response.json();
      setError(data?.error?.message ?? "Failed adding project skill");
      return;
    }

    setSkillName("");
    setLevel(3);
    await loadSkills();
  }

  return (
    <section className="space-y-4 rounded border border-black/10 bg-white p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold">Project Skills</h2>
        <button
          className="rounded border border-black/20 px-3 py-1.5 text-sm"
          onClick={importFromProfile}
        >
          Import my profile skills
        </button>
      </div>

      <form
        className="grid gap-3 sm:grid-cols-[1fr_120px_auto]"
        onSubmit={addProjectSkill}
      >
        <input
          className="rounded border border-black/20 px-3 py-2"
          placeholder="Custom project skill"
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
          Add
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <ul className="space-y-2 text-sm">
        {skills.map((skill) => (
          <li
            key={`${skill.userId}:${skill.skillId}`}
            className="rounded border border-black/10 p-3"
          >
            <span className="font-medium">{skill.skillName}</span> · level{" "}
            {skill.level} · {skill.source}
          </li>
        ))}
      </ul>
    </section>
  );
}
