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

function estimatedDurationLabel(remainingDays: number | null) {
  if (remainingDays === null) {
    return "Set a deadline to calculate timeline";
  }

  if (remainingDays <= 0) {
    return "Deadline is in the past";
  }

  return `${remainingDays} day${remainingDays === 1 ? "" : "s"} remaining from today`;
}

function ProjectDetailsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="h-5 w-5 text-violet-400"
    >
      <path
        d="M4 4h10M4 10h10M4 16h6M17 13l3 3-6 6H11v-3l6-6Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DeadlineIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="h-5 w-5 text-violet-400"
    >
      <rect
        x="4"
        y="5"
        width="16"
        height="15"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M8 3v4M16 3v4M4 10h16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TeamIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="h-5 w-5 text-violet-400"
    >
      <path
        d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-4A3.5 3.5 0 0 0 5 18.5V20M14.5 7.5A2.5 2.5 0 1 1 9.5 7.5a2.5 2.5 0 0 1 5 0ZM19.5 8v4M17.5 10h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-4 w-4">
      <circle cx="7" cy="12" r="2" fill="currentColor" />
      <circle cx="17" cy="6" r="2" fill="currentColor" />
      <circle cx="17" cy="18" r="2" fill="currentColor" />
      <path
        d="m8.8 11 6.4-4M8.8 13l6.4 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function EmptyRosterIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="h-5 w-5 text-violet-200"
    >
      <path
        d="M16 16.5a5 5 0 1 0-4-1.98M14.5 16.5 19 21M9 15.5v-.75a2.75 2.75 0 0 0-2.75-2.75h-1.5A2.75 2.75 0 0 0 2 14.75v.75M7.5 7.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ProjectForm() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [deadlineDate, setDeadlineDate] = useState("");
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [isAddingMilestone, setIsAddingMilestone] = useState(false);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState("");
  const [newMilestoneDate, setNewMilestoneDate] = useState("");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [newMemberInput, setNewMemberInput] = useState("");
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

  function addMilestoneFromInput() {
    const title = newMilestoneTitle.trim();
    const date = newMilestoneDate.trim();

    if (!date) {
      return;
    }

    setMilestones((current) => [
      ...current,
      { id: nextId(), title: title || "Untitled milestone", date },
    ]);
    setNewMilestoneTitle("");
    setNewMilestoneDate("");
    setIsAddingMilestone(false);
  }

  function removeMilestone(id: string) {
    setMilestones((current) =>
      current.filter((milestone) => milestone.id !== id),
    );
  }

  function parseMemberInput(input: string): TeamMember | null {
    const value = input.trim();

    if (!value) {
      return null;
    }

    const bracketMatch = value.match(/^(.+?)\s*<(.+?)>$/);

    if (bracketMatch) {
      return {
        id: nextId(),
        name: bracketMatch[1].trim(),
        email: bracketMatch[2].trim(),
      };
    }

    const parts = value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length >= 2) {
      return {
        id: nextId(),
        name: parts[0],
        email: parts.slice(1).join(", "),
      };
    }

    if (value.includes("@")) {
      return {
        id: nextId(),
        name: value.split("@")[0] ?? value,
        email: value,
      };
    }

    return {
      id: nextId(),
      name: value,
      email: "",
    };
  }

  function addMemberFromInput() {
    if (teamMembers.length >= MAX_TEAM_SIZE) {
      return;
    }

    const parsedMember = parseMemberInput(newMemberInput);

    if (!parsedMember) {
      return;
    }

    setTeamMembers((current) => [...current, parsedMember]);
    setNewMemberInput("");
    setIsAddingMember(false);
  }

  function removeMember(id: string) {
    setTeamMembers((current) => current.filter((member) => member.id !== id));
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#110a1f] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(103,47,180,0.24),transparent_38%),radial-gradient(circle_at_85%_20%,rgba(47,25,90,0.22),transparent_48%),linear-gradient(180deg,#120a24_0%,#130b22_55%,#120a1f_100%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1280px] flex-col">
        <main className="flex-1 px-6 pb-10 pt-10 lg:px-10 lg:pt-14">
          <div className="mb-10 space-y-3">
            <h1 className="text-6xl font-semibold tracking-tight text-white">
              Start Your Project
            </h1>
            <p className="text-[31px] text-slate-300/95">
              Set the foundation for your team&apos;s success with structured
              delegation.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
            <form
              id="project-setup-form"
              className="contents"
              onSubmit={onSubmit}
            >
              <section className="rounded-2xl border border-violet-900/45 bg-[#17191f]/85 p-6 md:col-span-8">
                <div className="mb-6 flex items-center gap-2.5">
                  <ProjectDetailsIcon />
                  <h2 className="text-4xl font-semibold text-white">
                    Project Details
                  </h2>
                </div>

                <div className="space-y-6">
                  <label className="block space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Project Name
                    </span>
                    <input
                      className="w-full rounded-xl border border-violet-950/80 bg-[#11091d] px-4 py-3.5 text-[28px] text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-violet-500"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="e.g. CS302 Distributed Systems Lab"
                      required
                    />
                  </label>

                  <label className="block space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Description
                      <span className="ml-1 text-[11px] lowercase tracking-normal text-slate-500 italic">
                        (optional)
                      </span>
                    </span>
                    <textarea
                      className="w-full resize-none rounded-xl border border-violet-950/80 bg-[#11091d] px-4 py-3.5 text-[27px] text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-violet-500"
                      rows={5}
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="Briefly explain the project goals and core milestones..."
                    />
                  </label>
                </div>
              </section>

              <section className="rounded-2xl border border-violet-900/45 bg-[#17191f]/85 p-6 md:col-span-4">
                <div className="mb-6 flex items-center gap-2.5">
                  <DeadlineIcon />
                  <h2 className="text-4xl font-semibold text-white">
                    Deadline
                  </h2>
                </div>

                <div className="space-y-4">
                  <label className="block space-y-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Main Project Deadline
                    </span>
                    <input
                      className="w-full rounded-xl border border-violet-950/80 bg-[#11091d] px-4 py-3.5 text-[28px] text-slate-100 outline-none transition focus:border-violet-500"
                      type="date"
                      value={deadlineDate}
                      onChange={(event) => setDeadlineDate(event.target.value)}
                      required
                    />
                  </label>

                  <div className="rounded-xl border border-violet-900/55 bg-violet-950/20 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Estimated Duration
                    </p>
                    <p className="mt-1 text-[27px] text-slate-200">
                      {estimatedDurationLabel(remainingDays)}
                    </p>
                  </div>

                  <div className="border-t border-violet-900/45 pt-5">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Milestones
                      </h3>
                      <button
                        className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-400 transition hover:text-violet-300"
                        type="button"
                        onClick={() => setIsAddingMilestone(true)}
                      >
                        + Add
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      {isAddingMilestone ? (
                        <div className="space-y-2 rounded-xl border border-violet-700/60 bg-[#11091d] p-3">
                          <input
                            className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
                            type="text"
                            value={newMilestoneTitle}
                            onChange={(event) =>
                              setNewMilestoneTitle(event.target.value)
                            }
                            onKeyDown={(event) => {
                              if (event.key !== "Enter") {
                                return;
                              }

                              event.preventDefault();
                              addMilestoneFromInput();
                            }}
                            placeholder="Milestone title"
                            autoFocus
                          />
                          <input
                            className="w-full bg-transparent text-sm text-slate-300 outline-none"
                            type="date"
                            value={newMilestoneDate}
                            onChange={(event) =>
                              setNewMilestoneDate(event.target.value)
                            }
                            onKeyDown={(event) => {
                              if (event.key !== "Enter") {
                                return;
                              }

                              event.preventDefault();
                              addMilestoneFromInput();
                            }}
                          />
                        </div>
                      ) : null}

                      {milestones.map((milestone) => (
                        <div
                          key={milestone.id}
                          className="rounded-xl border border-violet-900/35 bg-black/15 p-3"
                        >
                          <p className="mb-2 text-[22px] font-semibold text-slate-100">
                            {milestone.title}
                          </p>
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-xs text-slate-400">
                              {milestone.date}
                            </p>
                            <button
                              className="text-slate-500 transition hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
                              type="button"
                              onClick={() => removeMilestone(milestone.id)}
                              aria-label="Remove milestone"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      ))}

                      {milestones.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-violet-900/50 px-3 py-3 text-sm italic text-slate-500">
                          No milestones yet.
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-violet-900/45 bg-[#17191f]/85 p-6 md:col-span-7">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <TeamIcon />
                    <h2 className="text-4xl font-semibold text-white">
                      Team Roster
                    </h2>
                  </div>
                  <button
                    className="rounded-full border border-violet-600/70 bg-violet-600/20 px-3 py-1.5 text-[13px] font-semibold uppercase tracking-[0.1em] text-violet-200 transition hover:bg-violet-600/35 disabled:cursor-not-allowed disabled:opacity-45"
                    type="button"
                    onClick={() => setIsAddingMember(true)}
                    disabled={teamMembers.length >= MAX_TEAM_SIZE}
                  >
                    + Add Member
                  </button>
                </div>

                <div className="space-y-3">
                  {isAddingMember ? (
                    <input
                      className="w-full rounded-xl border border-violet-700/60 bg-[#11091d] px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-violet-500"
                      type="text"
                      value={newMemberInput}
                      onChange={(event) =>
                        setNewMemberInput(event.target.value)
                      }
                      onKeyDown={(event) => {
                        if (event.key !== "Enter") {
                          return;
                        }

                        event.preventDefault();
                        addMemberFromInput();
                      }}
                      placeholder="Name, email (or name <email>)"
                      autoFocus
                    />
                  ) : null}

                  {teamMembers.map((member) => (
                    <div
                      key={member.id}
                      className="grid grid-cols-1 items-center gap-3 rounded-xl border border-violet-900/35 bg-black/15 p-3 md:grid-cols-12"
                    >
                      <div className="md:col-span-5">
                        <p className="text-[26px] text-slate-200">
                          {member.name || "Unnamed member"}
                        </p>
                      </div>
                      <div className="md:col-span-6">
                        <p className="text-[25px] text-slate-400">
                          {member.email || "No email"}
                        </p>
                      </div>
                      <div className="flex justify-end md:col-span-1">
                        <button
                          className="text-slate-500 transition hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
                          type="button"
                          onClick={() => removeMember(member.id)}
                          aria-label="Remove team member"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}

                  {teamMembers.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-violet-900/50 p-3 text-sm italic text-slate-500">
                      No team members yet.
                    </div>
                  ) : null}
                </div>

                <div className="mt-7 border-t border-violet-900/45 pt-7 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-violet-900/35">
                    <EmptyRosterIcon />
                  </div>
                  <p className="text-[23px] text-slate-400">
                    Invite up to {MAX_TEAM_SIZE} team members to this project
                    workspace.
                  </p>
                </div>
              </section>
            </form>

            <section className="flex flex-col gap-4 md:col-span-5">
              <div className="rounded-2xl border border-violet-700/40 bg-violet-900/15 p-4">
                <button
                  className="group flex w-full items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-55"
                  type={project ? "button" : "submit"}
                  form={project ? undefined : "project-setup-form"}
                  onClick={project ? generateShareLink : undefined}
                  disabled={project ? isGeneratingLink : isSubmitting}
                >
                  <span>
                    {project
                      ? isGeneratingLink
                        ? "Generating Share Link..."
                        : "Share Project"
                      : isSubmitting
                        ? "Creating Project..."
                        : "Share Project"}
                  </span>
                  <span className="transition-transform group-hover:translate-x-1">
                    <ShareIcon />
                  </span>
                </button>

                <p className="mt-3 text-center text-xs italic text-slate-400">
                  * Invitations will be sent automatically to the email
                  addresses listed in the team roster.
                </p>
              </div>

              {error ? (
                <div className="rounded-xl border border-red-500/35 bg-red-950/35 p-3 text-sm text-red-200">
                  {error}
                </div>
              ) : null}

              {project ? (
                <div className="rounded-2xl border border-violet-700/35 bg-[#17191f]/85 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-violet-300">
                    Active Project
                  </p>
                  <p className="mt-1 text-[22px] font-semibold text-white">
                    {project.name}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Deadline: {new Date(project.deadline).toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-400">
                    Planning status: {project.planningStatus}
                  </p>

                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Link
                      href={`/projects/${project.id}/workspace`}
                      className="rounded-lg border border-violet-500/50 bg-violet-600/20 px-3 py-2 text-center text-xs font-semibold text-violet-100 transition hover:bg-violet-600/35"
                    >
                      Continue to Workspace Intake
                    </Link>
                    <Link
                      href={`/projects/${project.id}`}
                      className="rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2 text-center text-xs font-semibold text-slate-200 transition hover:bg-slate-900/70"
                    >
                      Open Project Dashboard
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-violet-900/45 bg-[#17191f]/85 p-4 text-xs text-slate-400">
                  Create the project first, then use Share Project to generate a
                  secure join link and send invites.
                </div>
              )}

              {project && joinLink ? (
                <div className="rounded-2xl border border-violet-700/35 bg-[#17191f]/85 p-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-violet-300">
                      Share URL
                    </p>
                    <p className="mt-1 break-all text-sm text-slate-100">
                      {joinLink.joinUrl}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Expires: {new Date(joinLink.expiresAt).toLocaleString()}
                    </p>
                  </div>

                  <button
                    className="mt-3 rounded-lg border border-violet-500/55 bg-violet-600/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-violet-100 transition hover:bg-violet-600/35"
                    type="button"
                    onClick={copyJoinLink}
                  >
                    {isCopyingLink ? "Copied" : "Copy Link"}
                  </button>

                  <div className="mt-4 rounded-xl border border-violet-900/45 bg-black/20 p-3">
                    <ShareEmailForm
                      projectId={project.id}
                      joinUrl={joinLink.joinUrl}
                      suggestedEmails={rosterEmails}
                    />
                  </div>
                </div>
              ) : null}
            </section>
          </div>
        </main>

        <footer className="border-t border-violet-900/45 px-6 py-6 text-center text-xs text-slate-500 lg:px-10">
          © 2024 Delegator Student Tools. Built for high-performing teams.
        </footer>
      </div>
    </div>
  );
}
