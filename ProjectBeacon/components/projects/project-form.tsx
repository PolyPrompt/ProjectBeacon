"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { ShareEmailForm } from "@/components/projects/share-email-form";

type ProjectResponse = {
  id: string;
  name: string;
  description: string;
  deadline: string;
  ownerUserId: string;
  planningStatus: "draft" | "locked" | "assigned";
};

type ProjectJoinLink = {
  projectId: string;
  token: string;
  expiresAt: string;
  joinUrl: string;
};

type Milestone = {
  id: string;
  title: string;
  date: string;
};

type TeamMember = {
  id: string;
  name: string;
  email: string;
};

const MAX_TEAM_SIZE = 8;

function nextId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function daysUntil(dateValue: string) {
  if (!dateValue) {
    return null;
  }

  const deadline = new Date(`${dateValue}T23:59:59`);

  if (Number.isNaN(deadline.getTime())) {
    return null;
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  const diff = deadline.getTime() - Date.now();
  return Math.ceil(diff / msPerDay);
}

export function ProjectForm() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [deadlineDate, setDeadlineDate] = useState("");
  const [milestones, setMilestones] = useState<Milestone[]>([
    { id: nextId(), title: "", date: "" },
  ]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([
    { id: nextId(), name: "", email: "" },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [isCopyingLink, setIsCopyingLink] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<ProjectResponse | null>(null);
  const [joinLink, setJoinLink] = useState<ProjectJoinLink | null>(null);

  const rosterEmails = useMemo(
    () =>
      Array.from(
        new Set(
          teamMembers
            .map((member) => member.email.trim())
            .filter((email) => email.length > 0),
        ),
      ),
    [teamMembers],
  );

  const remainingDays = daysUntil(deadlineDate);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!deadlineDate) {
      setError("Select a project deadline");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          description,
          deadline: new Date(`${deadlineDate}T23:59:59`).toISOString(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data?.error?.message ?? "Failed to create project");
        return;
      }

      setProject(data as ProjectResponse);
      setJoinLink(null);
    } catch {
      setError("Failed to create project");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function generateShareLink() {
    if (!project) {
      return;
    }

    setIsGeneratingLink(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${project.id}/share-link`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data?.error?.message ?? "Failed to generate share link");
        return;
      }

      setJoinLink(data as ProjectJoinLink);
    } catch {
      setError("Failed to generate share link");
    } finally {
      setIsGeneratingLink(false);
    }
  }

  async function copyJoinLink() {
    if (!joinLink) {
      return;
    }

    setIsCopyingLink(true);

    try {
      await navigator.clipboard.writeText(joinLink.joinUrl);
    } finally {
      setTimeout(() => {
        setIsCopyingLink(false);
      }, 1200);
    }
  }

  function updateMilestone(id: string, updates: Partial<Milestone>) {
    setMilestones((current) =>
      current.map((milestone) =>
        milestone.id === id ? { ...milestone, ...updates } : milestone,
      ),
    );
  }

  function removeMilestone(id: string) {
    setMilestones((current) =>
      current.length === 1
        ? current
        : current.filter((milestone) => milestone.id !== id),
    );
  }

  function updateMember(id: string, updates: Partial<TeamMember>) {
    setTeamMembers((current) =>
      current.map((member) =>
        member.id === id ? { ...member, ...updates } : member,
      ),
    );
  }

  function removeMember(id: string) {
    setTeamMembers((current) =>
      current.length === 1
        ? current
        : current.filter((member) => member.id !== id),
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-10 lg:px-10">
      <div className="mb-8 rounded-2xl border border-black/10 bg-gradient-to-r from-emerald-50 via-sky-50 to-amber-50 p-6">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          Start Your Project
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-black/65 md:text-base">
          Define scope, timeline, and collaborators before generating a share
          link for your team.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
        <form id="project-setup-form" className="contents" onSubmit={onSubmit}>
          <section className="md:col-span-8 rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Project Details</h2>
              <span className="rounded-full bg-black/5 px-2.5 py-1 text-xs font-medium text-black/60">
                Core setup
              </span>
            </div>

            <div className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-black/50">
                  Project Name
                </span>
                <input
                  className="w-full rounded-lg border border-black/15 bg-white px-3 py-2.5 outline-none ring-emerald-500/30 transition focus:ring-4"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. CS302 Distributed Systems Lab"
                  required
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-black/50">
                  Description
                </span>
                <textarea
                  className="w-full rounded-lg border border-black/15 bg-white px-3 py-2.5 outline-none ring-emerald-500/30 transition focus:ring-4"
                  rows={5}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Describe goals, scope, and expected outcomes"
                  required
                />
              </label>
            </div>
          </section>

          <section className="md:col-span-4 rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-xl font-semibold">
              Deadline & Milestones
            </h2>

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-black/50">
                Main Deadline
              </span>
              <input
                className="w-full rounded-lg border border-black/15 bg-white px-3 py-2.5 outline-none ring-emerald-500/30 transition focus:ring-4"
                type="date"
                value={deadlineDate}
                onChange={(event) => setDeadlineDate(event.target.value)}
                required
              />
            </label>

            <div className="mt-4 rounded-lg border border-black/10 bg-black/[0.03] p-3 text-sm">
              <p className="text-xs uppercase tracking-wide text-black/50">
                Estimated Duration
              </p>
              <p className="mt-1 font-medium">
                {remainingDays === null
                  ? "Set a deadline to calculate timeline"
                  : remainingDays <= 0
                    ? "Deadline is in the past"
                    : `${remainingDays} day${remainingDays === 1 ? "" : "s"} remaining`}
              </p>
            </div>

            <div className="mt-6 border-t border-black/10 pt-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-black/50">
                  Milestones
                </h3>
                <button
                  className="rounded-md border border-black/15 px-2.5 py-1 text-xs font-medium"
                  type="button"
                  onClick={() =>
                    setMilestones((current) => [
                      ...current,
                      { id: nextId(), title: "", date: "" },
                    ])
                  }
                >
                  Add
                </button>
              </div>

              <div className="space-y-2.5">
                {milestones.map((milestone) => (
                  <div
                    key={milestone.id}
                    className="rounded-lg border border-black/10 bg-black/[0.02] p-3"
                  >
                    <input
                      className="mb-2 w-full rounded border border-black/10 bg-white px-2 py-1.5 text-sm"
                      type="text"
                      placeholder="Milestone title"
                      value={milestone.title}
                      onChange={(event) =>
                        updateMilestone(milestone.id, {
                          title: event.target.value,
                        })
                      }
                    />
                    <div className="flex items-center gap-2">
                      <input
                        className="w-full rounded border border-black/10 bg-white px-2 py-1.5 text-xs"
                        type="date"
                        value={milestone.date}
                        onChange={(event) =>
                          updateMilestone(milestone.id, {
                            date: event.target.value,
                          })
                        }
                      />
                      <button
                        className="rounded border border-black/15 px-2 py-1 text-xs"
                        type="button"
                        onClick={() => removeMilestone(milestone.id)}
                        disabled={milestones.length === 1}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="md:col-span-7 rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Team Roster</h2>
              <button
                className="rounded-full border border-black/20 px-3 py-1.5 text-xs font-semibold"
                type="button"
                onClick={() =>
                  setTeamMembers((current) => {
                    if (current.length >= MAX_TEAM_SIZE) {
                      return current;
                    }

                    return [...current, { id: nextId(), name: "", email: "" }];
                  })
                }
                disabled={teamMembers.length >= MAX_TEAM_SIZE}
              >
                Add Member
              </button>
            </div>

            <div className="space-y-2.5">
              {teamMembers.map((member) => (
                <div
                  key={member.id}
                  className="grid grid-cols-1 gap-2 rounded-lg border border-black/10 bg-black/[0.02] p-3 md:grid-cols-[2fr_2fr_auto]"
                >
                  <input
                    className="rounded border border-black/10 bg-white px-2.5 py-2 text-sm"
                    type="text"
                    placeholder="Full name"
                    value={member.name}
                    onChange={(event) =>
                      updateMember(member.id, { name: event.target.value })
                    }
                  />
                  <input
                    className="rounded border border-black/10 bg-white px-2.5 py-2 text-sm"
                    type="email"
                    placeholder="Email address"
                    value={member.email}
                    onChange={(event) =>
                      updateMember(member.id, { email: event.target.value })
                    }
                  />
                  <button
                    className="rounded border border-black/15 px-2.5 py-2 text-xs"
                    type="button"
                    onClick={() => removeMember(member.id)}
                    disabled={teamMembers.length === 1}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <p className="mt-4 text-sm text-black/60">
              Invite up to {MAX_TEAM_SIZE} teammates after creating the project.
            </p>
          </section>
        </form>

        <section className="md:col-span-5 rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Share & Invite</h2>

          <button
            className="mt-4 w-full rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            type="submit"
            form="project-setup-form"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Creating project..." : "Create Project Workspace"}
          </button>

          {project && (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
              <p className="font-semibold">Project created</p>
              <p className="mt-1 break-all">{project.name}</p>
              <p className="text-xs text-black/65">
                Deadline: {new Date(project.deadline).toLocaleString()}
              </p>
            </div>
          )}

          {project ? (
            <div className="mt-4 space-y-3 rounded-lg border border-sky-200 bg-sky-50 p-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-sky-800/80">
                  Active project context
                </p>
                <p className="mt-1 text-sm font-semibold text-sky-950">
                  {project.name}
                </p>
                <p className="mt-1 text-xs text-sky-900/80">
                  Project ID: {project.id}
                </p>
                <p className="text-xs text-sky-900/80">
                  Planning status: {project.planningStatus}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Link
                  href={`/projects/${project.id}/workspace`}
                  className="rounded-lg bg-sky-700 px-3 py-2 text-center text-sm font-semibold text-white transition hover:bg-sky-600"
                >
                  Continue to Workspace Intake
                </Link>
                <Link
                  href={`/projects/${project.id}`}
                  className="rounded-lg border border-sky-700/30 bg-white px-3 py-2 text-center text-sm font-semibold text-sky-900 transition hover:bg-sky-100"
                >
                  Open Project Dashboard
                </Link>
              </div>
            </div>
          ) : null}

          <button
            className="mt-3 w-full rounded-lg border border-black/20 px-4 py-2 text-sm font-medium disabled:opacity-50"
            type="button"
            onClick={generateShareLink}
            disabled={!project || isGeneratingLink}
          >
            {isGeneratingLink ? "Generating link..." : "Generate Share Link"}
          </button>

          {project && joinLink && (
            <div className="mt-4 space-y-3 rounded-lg border border-black/10 bg-black/[0.02] p-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-black/50">
                  Share URL
                </p>
                <p className="mt-1 break-all text-sm">{joinLink.joinUrl}</p>
                <p className="mt-1 text-xs text-black/60">
                  Expires: {new Date(joinLink.expiresAt).toLocaleString()}
                </p>
              </div>
              <button
                className="rounded-lg border border-black/20 px-3 py-1.5 text-sm"
                type="button"
                onClick={copyJoinLink}
              >
                {isCopyingLink ? "Copied" : "Copy Link"}
              </button>
              <ShareEmailForm
                projectId={project.id}
                joinUrl={joinLink.joinUrl}
                suggestedEmails={rosterEmails}
              />
            </div>
          )}

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

          {!project && (
            <p className="mt-4 text-xs text-black/60">
              Create the project first, then generate a join link and send
              invites.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
