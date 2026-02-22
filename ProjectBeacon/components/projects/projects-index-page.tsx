"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type ProjectsIndexItem = {
  id: string;
  name: string;
  description: string;
  deadline: string;
  planningStatus: "draft" | "locked" | "assigned";
};

type ProjectsIndexPageProps = {
  projects: ProjectsIndexItem[];
};

const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-fuchsia-500",
  "bg-rose-500",
  "bg-cyan-500",
];

function formatDueDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "No due date";
  }

  return `Due: ${date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })}`;
}

function daysUntil(value: string): number | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const diff = date.getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function courseTag(projectName: string): string {
  const match = projectName.match(/\b([A-Za-z]{2,4})\s?(\d{2,3})\b/);
  if (match) {
    return `${match[1].toUpperCase()} ${match[2]}`;
  }

  return "CS 301";
}

function initialsFromName(projectName: string): string[] {
  const tokens = projectName
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((token) => token[0]?.toUpperCase() ?? "")
    .filter(Boolean);

  if (tokens.length > 0) {
    return tokens;
  }

  return ["P"];
}

function deadlineTextClass(daysLeft: number | null): string {
  if (daysLeft !== null && daysLeft <= 7) {
    return "text-violet-400";
  }

  return "text-slate-400";
}

export function ProjectsIndexPage({ projects }: ProjectsIndexPageProps) {
  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState("all");

  const classOptions = useMemo(() => {
    const tags = Array.from(
      new Set(projects.map((project) => courseTag(project.name))),
    );
    return ["all", ...tags];
  }, [projects]);

  const visibleProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return projects
      .filter((project) => {
        if (classFilter !== "all" && courseTag(project.name) !== classFilter) {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        return (
          project.name.toLowerCase().includes(normalizedQuery) ||
          project.description.toLowerCase().includes(normalizedQuery)
        );
      })
      .sort((left, right) => {
        const leftDeadline = new Date(left.deadline).getTime();
        const rightDeadline = new Date(right.deadline).getTime();

        if (Number.isNaN(leftDeadline) && Number.isNaN(rightDeadline)) {
          return 0;
        }
        if (Number.isNaN(leftDeadline)) {
          return 1;
        }
        if (Number.isNaN(rightDeadline)) {
          return -1;
        }

        return leftDeadline - rightDeadline;
      });
  }, [classFilter, projects, query]);

  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-6 text-slate-100 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            My Projects
          </h1>
          <p className="mt-2 text-base text-slate-400 sm:text-lg">
            Manage and delegate your CS coursework assignments.
          </p>
        </div>

        <Link
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-base font-semibold text-white shadow-[0_10px_24px_rgba(109,40,217,0.35)] transition hover:bg-violet-500"
          href="/projects/new"
        >
          <span className="text-xl leading-none">+</span>
          New Project
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label className="group flex min-h-12 min-w-[240px] flex-1 items-center gap-3 rounded-xl border border-violet-900/40 bg-[#141b2e]/70 px-4">
          <svg
            aria-hidden="true"
            className="h-4 w-4 text-slate-400"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            className="w-full bg-transparent text-base text-slate-100 outline-none placeholder:text-slate-500"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search your projects..."
            value={query}
          />
        </label>

        <select
          className="min-h-12 rounded-xl border border-violet-500/40 bg-violet-600 px-4 text-sm font-semibold text-white outline-none transition hover:bg-violet-500"
          onChange={(event) => setClassFilter(event.target.value)}
          value={classFilter}
        >
          {classOptions.map((option) => (
            <option key={option} value={option}>
              {option === "all" ? "All Classes" : option}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-8 flex items-center gap-4">
        <h2 className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
          Recently Created
        </h2>
        <div className="h-px flex-1 bg-violet-900/40" />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        {visibleProjects.map((project) => {
          const avatars = initialsFromName(project.name);
          const remaining = daysUntil(project.deadline);

          return (
            <article
              key={project.id}
              className="rounded-xl border border-violet-900/45 bg-[#0f1127]/80 p-5 shadow-[inset_0_0_0_1px_rgba(76,29,149,0.18)]"
            >
              <div className="flex items-start justify-between">
                <span className="rounded-full bg-violet-800/35 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-300">
                  {courseTag(project.name)}
                </span>
                <button
                  aria-label={`More options for ${project.name}`}
                  className="text-xl font-bold tracking-widest text-slate-500 transition hover:text-slate-300"
                  type="button"
                >
                  ...
                </button>
              </div>

              <h3 className="mt-5 text-xl font-semibold leading-tight text-slate-100 sm:text-2xl">
                {project.name}
              </h3>

              <p
                className={`mt-3 flex items-center gap-2 text-sm ${deadlineTextClass(remaining)}`}
              >
                <svg
                  aria-hidden="true"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <rect x="4" y="5" width="16" height="15" rx="2.5" />
                  <path d="M8 3v4M16 3v4M4 10h16" />
                </svg>
                {formatDueDate(project.deadline)}
              </p>

              <div className="mt-6 flex items-center justify-between">
                <div className="flex -space-x-2">
                  {avatars.map((label, index) => (
                    <span
                      key={`${project.id}-${label}-${index}`}
                      className={`grid h-7 w-7 place-items-center rounded-full border-2 border-[#0f1127] text-[10px] font-bold text-white ${
                        AVATAR_COLORS[index % AVATAR_COLORS.length]
                      }`}
                    >
                      {label}
                    </span>
                  ))}
                </div>

                <Link
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-400 transition hover:text-violet-300"
                  href={`/projects/${project.id}`}
                >
                  Details
                  <span className="text-sm">›</span>
                </Link>
              </div>
            </article>
          );
        })}

        <Link
          className="grid min-h-[210px] place-items-center rounded-xl border-2 border-dashed border-cyan-900/60 bg-[#0d1022]/40 p-5 text-center transition hover:border-cyan-600/70 hover:bg-[#11142a]"
          href="/projects/new"
        >
          <div className="space-y-2">
            <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-slate-800/80 text-2xl text-slate-300">
              +
            </div>
            <p className="text-lg font-semibold text-slate-300">New Project</p>
          </div>
        </Link>
      </div>
    </section>
  );
}
