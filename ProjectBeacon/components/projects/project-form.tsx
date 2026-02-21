"use client";

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

type MilestoneDraft = {
  id: string;
  title: string;
  dueDate: string;
};

type TeamMemberDraft = {
  id: string;
  name: string;
  email: string;
};

function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function ProjectForm() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");

  const [milestones, setMilestones] = useState<MilestoneDraft[]>([
    {
      id: createId("ms"),
      title: "",
      dueDate: "",
    },
  ]);

  const [teamMembers, setTeamMembers] = useState<TeamMemberDraft[]>([
    {
      id: createId("member"),
      name: "",
      email: "",
    },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<ProjectResponse | null>(null);
  const [joinLink, setJoinLink] = useState<ProjectJoinLink | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const durationLabel = useMemo(() => {
    if (!deadline) {
      return "Set a deadline to estimate duration";
    }

    const targetDate = new Date(`${deadline}T00:00:00.000Z`);
    if (Number.isNaN(targetDate.getTime())) {
      return "Invalid deadline";
    }

    const diffMs = targetDate.getTime() - Date.now();
    const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));

    if (diffDays < 0) {
      return "Deadline is in the past";
    }

    if (diffDays === 0) {
      return "Due today";
    }

    if (diffDays === 1) {
      return "1 day remaining";
    }

    return `${diffDays} days remaining`;
  }, [deadline]);

  const rosterEmails = useMemo(
    () =>
      teamMembers
        .map((member) => member.email.trim())
        .filter((email) => email.length > 0),
    [teamMembers],
  );

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const parsedDeadline = new Date(`${deadline}T00:00:00.000Z`);
      if (Number.isNaN(parsedDeadline.getTime())) {
        setError("Please select a valid deadline.");
        return;
      }

      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          description,
          deadline: parsedDeadline.toISOString(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data?.error?.message ?? "Failed to create project");
        return;
      }

      setProject(data as ProjectResponse);
      setJoinLink(null);
      setCopiedLink(false);
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
      setCopiedLink(false);
    } catch {
      setError("Failed to generate share link");
    } finally {
      setIsGeneratingLink(false);
    }
  }

  function updateMilestone(
    milestoneId: string,
    key: "title" | "dueDate",
    value: string,
  ) {
    setMilestones((current) =>
      current.map((milestone) =>
        milestone.id === milestoneId
          ? { ...milestone, [key]: value }
          : milestone,
      ),
    );
  }

  function removeMilestone(milestoneId: string) {
    setMilestones((current) => {
      const filtered = current.filter(
        (milestone) => milestone.id !== milestoneId,
      );
      return filtered.length > 0
        ? filtered
        : [{ id: createId("ms"), title: "", dueDate: "" }];
    });
  }

  function addMilestone() {
    setMilestones((current) => [
      ...current,
      { id: createId("ms"), title: "", dueDate: "" },
    ]);
  }

  function updateTeamMember(
    memberId: string,
    key: "name" | "email",
    value: string,
  ) {
    setTeamMembers((current) =>
      current.map((member) =>
        member.id === memberId ? { ...member, [key]: value } : member,
      ),
    );
  }

  function removeTeamMember(memberId: string) {
    setTeamMembers((current) => {
      const filtered = current.filter((member) => member.id !== memberId);
      return filtered.length > 0
        ? filtered
        : [{ id: createId("member"), name: "", email: "" }];
    });
  }

  function addTeamMember() {
    setTeamMembers((current) => [
      ...current,
      { id: createId("member"), name: "", email: "" },
    ]);
  }

  async function copyJoinUrl() {
    if (!joinLink) {
      return;
    }

    await navigator.clipboard.writeText(joinLink.joinUrl);
    setCopiedLink(true);
  }

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">
          Start Your Project
        </h1>
        <p className="max-w-3xl text-slate-600">
          Capture project details, set a deadline, prepare your team roster, and
          generate a share link from one setup workspace.
        </p>
      </header>

      {error ? (
        <p className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
        <form
          className="contents"
          onSubmit={onSubmit}
          aria-label="Create a project"
        >
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:col-span-8">
            <div className="mb-5 flex items-center gap-2">
              <span className="rounded-md bg-sky-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-sky-700">
                Project Details
              </span>
            </div>

            <div className="space-y-4">
              <label className="block space-y-1">
                <span className="text-sm font-semibold text-slate-700">
                  Project Name
                </span>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. CS302 Distributed Systems Lab"
                  required
                  value={name}
                />
              </label>

              <label className="block space-y-1">
                <span className="text-sm font-semibold text-slate-700">
                  Description
                </span>
                <textarea
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Briefly explain project goals and milestones"
                  required
                  rows={5}
                  value={description}
                />
              </label>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:col-span-4">
            <div className="mb-5 flex items-center gap-2">
              <span className="rounded-md bg-violet-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-violet-700">
                Deadline
              </span>
            </div>

            <label className="block space-y-1">
              <span className="text-sm font-semibold text-slate-700">
                Main Project Deadline
              </span>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                onChange={(event) => setDeadline(event.target.value)}
                required
                type="date"
                value={deadline}
              />
            </label>

            <p className="mt-3 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-800">
              {durationLabel}
            </p>

            <div className="mt-5 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Milestones (local draft)
                </h3>
                <button
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  onClick={addMilestone}
                  type="button"
                >
                  Add
                </button>
              </div>

              <div className="space-y-2">
                {milestones.map((milestone) => (
                  <div
                    key={milestone.id}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-2"
                  >
                    <input
                      className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                      onChange={(event) =>
                        updateMilestone(
                          milestone.id,
                          "title",
                          event.target.value,
                        )
                      }
                      placeholder="Milestone name"
                      type="text"
                      value={milestone.title}
                    />
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                        onChange={(event) =>
                          updateMilestone(
                            milestone.id,
                            "dueDate",
                            event.target.value,
                          )
                        }
                        type="date"
                        value={milestone.dueDate}
                      />
                      <button
                        className="rounded border border-rose-300 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                        onClick={() => removeMilestone(milestone.id)}
                        type="button"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="md:col-span-12">
            <button
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-70"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Creating..." : "Create Project"}
            </button>
          </div>
        </form>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:col-span-7">
          <div className="mb-5 flex items-center justify-between gap-2">
            <span className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Team Roster
            </span>
            <button
              className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              onClick={addTeamMember}
              type="button"
            >
              Add Member
            </button>
          </div>

          <div className="space-y-3">
            {teamMembers.map((member) => (
              <div
                key={member.id}
                className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-12"
              >
                <input
                  className="rounded border border-slate-300 px-2 py-1 text-sm sm:col-span-5"
                  onChange={(event) =>
                    updateTeamMember(member.id, "name", event.target.value)
                  }
                  placeholder="Full name"
                  type="text"
                  value={member.name}
                />
                <input
                  className="rounded border border-slate-300 px-2 py-1 text-sm sm:col-span-6"
                  onChange={(event) =>
                    updateTeamMember(member.id, "email", event.target.value)
                  }
                  placeholder="Email address"
                  type="email"
                  value={member.email}
                />
                <button
                  className="rounded border border-rose-300 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 sm:col-span-1"
                  onClick={() => removeTeamMember(member.id)}
                  type="button"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:col-span-5">
          <div className="mb-5 flex items-center gap-2">
            <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
              Share & Invite
            </span>
          </div>

          {!project ? (
            <p className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-600">
              Create a project first, then generate a share link and send invite
              emails.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">{project.name}</p>
                <p>Status: {project.planningStatus}</p>
                <p>
                  Deadline: {new Date(project.deadline).toLocaleDateString()}
                </p>
              </div>

              <button
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-70"
                disabled={isGeneratingLink}
                onClick={generateShareLink}
                type="button"
              >
                {isGeneratingLink ? "Generating..." : "Generate Share Link"}
              </button>

              {joinLink ? (
                <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                  <p className="break-all">{joinLink.joinUrl}</p>
                  <p>
                    Expires: {new Date(joinLink.expiresAt).toLocaleString()}
                  </p>
                  <button
                    className="rounded border border-emerald-300 px-2 py-1 text-xs font-semibold hover:bg-emerald-100"
                    onClick={() => void copyJoinUrl()}
                    type="button"
                  >
                    {copiedLink ? "Copied" : "Copy link"}
                  </button>
                </div>
              ) : null}

              {rosterEmails.length > 0 ? (
                <p className="text-xs text-slate-500">
                  Roster emails ready: {rosterEmails.join(", ")}
                </p>
              ) : null}

              {joinLink ? (
                <ShareEmailForm
                  projectId={project.id}
                  joinUrl={joinLink.joinUrl}
                />
              ) : null}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
