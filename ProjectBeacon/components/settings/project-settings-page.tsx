"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type ProjectSettingsPageProps = {
  projectId: string;
  role: "admin" | "user";
};

type ProjectMetadata = {
  name: string;
  deadline: string;
};

type ProjectMember = {
  userId: string;
  name: string;
  email: string;
  role: "owner" | "member";
};

type ProjectMilestone = {
  id: string;
  title: string;
  dueAt: string;
  status: "todo" | "in_progress" | "blocked" | "done";
};

const DEFAULT_METADATA: ProjectMetadata = {
  name: "Untitled Project",
  deadline: "",
};

function toDateInputValue(value: string): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function toMilestoneLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ProjectSettingsPage({
  projectId,
  role,
}: ProjectSettingsPageProps) {
  const router = useRouter();
  const isAdmin = role === "admin";
  const [metadata, setMetadata] = useState<ProjectMetadata>(DEFAULT_METADATA);
  const [loadingMetadata, setLoadingMetadata] = useState(isAdmin);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [loadingMilestones, setLoadingMilestones] = useState(true);
  const [isAddingMilestone, setIsAddingMilestone] = useState(false);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState("");
  const [newMilestoneDate, setNewMilestoneDate] = useState("");
  const [isSavingMilestone, setIsSavingMilestone] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [teamStatus, setTeamStatus] = useState<string | null>(null);
  const [milestoneStatus, setMilestoneStatus] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    async function loadProjectMetadata() {
      try {
        setLoadingMetadata(true);
        const response = await fetch(`/api/projects/${projectId}`, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(
            `Project metadata request returned ${response.status}`,
          );
        }

        const payload = (await response.json()) as {
          name?: string;
          deadline?: string;
        };

        if (!cancelled) {
          setMetadata({
            name: payload.name ?? DEFAULT_METADATA.name,
            deadline: toDateInputValue(payload.deadline ?? ""),
          });
        }
      } catch (metadataError) {
        if (!cancelled) {
          setStatus(
            metadataError instanceof Error
              ? `${metadataError.message}. Using editable scaffold metadata.`
              : "Failed to load project metadata. Using editable scaffold metadata.",
          );
          setMetadata({
            name: `Project ${projectId}`,
            deadline: toDateInputValue(
              new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            ),
          });
        }
      } finally {
        if (!cancelled) {
          setLoadingMetadata(false);
        }
      }
    }

    void loadProjectMetadata();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [isAdmin, projectId]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadMembers() {
      try {
        setLoadingMembers(true);
        const response = await fetch(`/api/projects/${projectId}/members`, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });

        const payload = (await response.json()) as {
          members?: ProjectMember[];
          error?: { message?: string };
        };

        if (!response.ok) {
          throw new Error(
            payload?.error?.message ??
              `Members request returned ${response.status}`,
          );
        }

        if (!cancelled) {
          setMembers(Array.isArray(payload.members) ? payload.members : []);
        }
      } catch (membersError) {
        if (!cancelled) {
          setTeamStatus(
            membersError instanceof Error
              ? membersError.message
              : "Failed to load project members.",
          );
          setMembers([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingMembers(false);
        }
      }
    }

    void loadMembers();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadMilestones() {
      try {
        setLoadingMilestones(true);
        const response = await fetch(`/api/projects/${projectId}/milestones`, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });

        const payload = (await response.json()) as {
          milestones?: ProjectMilestone[];
          error?: { message?: string };
        };

        if (!response.ok) {
          throw new Error(
            payload?.error?.message ??
              `Milestones request returned ${response.status}`,
          );
        }

        if (!cancelled) {
          const data = Array.isArray(payload.milestones)
            ? payload.milestones
            : [];
          setMilestones(
            data.filter((milestone) => milestone.status !== "done"),
          );
        }
      } catch (milestonesError) {
        if (!cancelled) {
          setMilestoneStatus(
            milestonesError instanceof Error
              ? milestonesError.message
              : "Failed to load milestones.",
          );
          setMilestones([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingMilestones(false);
        }
      }
    }

    void loadMilestones();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [projectId]);

  async function handleInviteByEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = newMemberName.trim();
    const email = newMemberEmail.trim();
    if (!name || !email) {
      return;
    }

    const alreadyMember = members.some(
      (member) => member.email.toLowerCase() === email.toLowerCase(),
    );

    if (alreadyMember) {
      setTeamStatus(`${email} is already a member of this project.`);
      return;
    }

    try {
      setIsSendingInvite(true);
      setTeamStatus(null);
      const response = await fetch(`/api/projects/${projectId}/share-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: [email] }),
      });

      const payload = (await response.json()) as {
        sent?: Array<{ email: string }>;
        failed?: Array<{ email: string; reason: string }>;
        error?: { message?: string };
      };

      if (!response.ok) {
        throw new Error(
          payload?.error?.message ??
            `Invite request returned ${response.status}`,
        );
      }

      const sentCount = Array.isArray(payload.sent) ? payload.sent.length : 0;
      const failedCount = Array.isArray(payload.failed)
        ? payload.failed.length
        : 0;

      if (failedCount > 0) {
        const firstFailure = payload.failed?.[0];
        setTeamStatus(
          firstFailure?.reason
            ? `Failed to send invite to ${firstFailure.email}: ${firstFailure.reason}`
            : "Failed to send invite email.",
        );
        return;
      }

      if (sentCount > 0) {
        setTeamStatus(`Invite sent to ${name} (${email}).`);
        setNewMemberName("");
        setNewMemberEmail("");
        setIsAddingMember(false);
      } else {
        setTeamStatus("No invite was sent.");
      }
    } catch (inviteError) {
      setTeamStatus(
        inviteError instanceof Error
          ? inviteError.message
          : "Failed to send invite email.",
      );
    } finally {
      setIsSendingInvite(false);
    }
  }

  async function handleAddMilestone(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = newMilestoneTitle.trim();
    const date = newMilestoneDate.trim();

    if (!title || !date) {
      return;
    }

    try {
      setIsSavingMilestone(true);
      setMilestoneStatus(null);

      const dueAt = new Date(`${date}T00:00:00.000Z`).toISOString();
      const response = await fetch(`/api/projects/${projectId}/milestones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, dueAt }),
      });

      const payload = (await response.json()) as
        | ProjectMilestone
        | { error?: { message?: string } };

      if (!response.ok) {
        throw new Error(
          "error" in payload
            ? (payload.error?.message ?? "Failed to create milestone.")
            : "Failed to create milestone.",
        );
      }

      if (
        "id" in payload &&
        "title" in payload &&
        "dueAt" in payload &&
        "status" in payload
      ) {
        setMilestones((current) =>
          [...current, payload]
            .filter((milestone) => milestone.status !== "done")
            .sort(
              (left, right) =>
                new Date(left.dueAt).getTime() -
                new Date(right.dueAt).getTime(),
            ),
        );
      }

      setNewMilestoneTitle("");
      setNewMilestoneDate("");
      setIsAddingMilestone(false);
      setMilestoneStatus("Milestone added.");
    } catch (milestoneError) {
      setMilestoneStatus(
        milestoneError instanceof Error
          ? milestoneError.message
          : "Failed to create milestone.",
      );
    } finally {
      setIsSavingMilestone(false);
    }
  }

  async function handleDeleteMilestone(id: string) {
    try {
      setMilestoneStatus(null);

      const response = await fetch(`/api/projects/${projectId}/milestones`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const payload = (await response.json()) as
        | { deleted?: boolean }
        | { error?: { message?: string } };

      if (!response.ok) {
        throw new Error(
          "error" in payload
            ? (payload.error?.message ?? "Failed deleting milestone.")
            : "Failed deleting milestone.",
        );
      }

      setMilestones((current) =>
        current.filter((milestone) => milestone.id !== id),
      );
      setMilestoneStatus("Milestone removed.");
    } catch (milestoneError) {
      setMilestoneStatus(
        milestoneError instanceof Error
          ? milestoneError.message
          : "Failed deleting milestone.",
      );
    }
  }

  async function handleLeaveProject() {
    try {
      setStatus(null);
      const response = await fetch(`/api/projects/${projectId}/leave`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(`Leave request returned ${response.status}`);
      }

      router.push("/");
      router.refresh();
    } catch (leaveError) {
      setStatus(
        leaveError instanceof Error
          ? leaveError.message
          : "Failed to leave project.",
      );
    }
  }

  async function handleSaveAdminSettings(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    try {
      setStatus(null);
      const payload = {
        name: metadata.name,
        deadline: metadata.deadline
          ? new Date(`${metadata.deadline}T00:00:00.000Z`).toISOString()
          : null,
      };

      const response = await fetch(`/api/projects/${projectId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Settings update returned ${response.status}`);
      }

      setStatus("Project settings updated.");
    } catch (updateError) {
      setStatus(
        updateError instanceof Error
          ? `${updateError.message}. API may still be pending.`
          : "Failed to update project settings.",
      );
    }
  }

  async function handleDeleteProject() {
    if (deleting) {
      return;
    }

    try {
      setDeleting(true);
      setStatus(null);

      const response = await fetch(`/api/projects/${projectId}/settings`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(`Delete request returned ${response.status}`);
      }

      router.push("/");
      router.refresh();
    } catch (deleteError) {
      setStatus(
        deleteError instanceof Error
          ? `${deleteError.message}. Delete endpoint may still be pending.`
          : "Failed to delete project.",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="relative left-1/2 w-screen -translate-x-1/2 bg-[#120d1c]">
      <div className="mx-auto min-h-[calc(100vh-73px)] w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <header className="space-y-2">
          <h1 className="text-4xl font-black tracking-tight text-slate-100">
            {isAdmin ? "Admin Project Settings" : "Project Settings"}
          </h1>
          <p className="text-lg text-slate-400">
            Manage your distributed systems project details and team roster.
          </p>
        </header>

        {status ? (
          <p className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-sm text-violet-100">
            {status}
          </p>
        ) : null}

        {isAdmin ? (
          <section className="rounded-2xl border border-violet-500/20 bg-[#1a1228]/90 p-5 shadow-lg shadow-black/20">
            <h2 className="text-3xl font-semibold text-slate-100">
              Project Overview
            </h2>
            <form
              className="mt-5 grid gap-4 md:grid-cols-2"
              onSubmit={handleSaveAdminSettings}
            >
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Project Name
                </span>
                <input
                  className="w-full rounded-lg border border-violet-500/20 bg-[#150f23] px-3 py-3 text-sm text-slate-100 outline-none transition focus:border-violet-400"
                  disabled={loadingMetadata}
                  onChange={(event) =>
                    setMetadata((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  type="text"
                  value={metadata.name}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Submission Deadline
                </span>
                <input
                  className="w-full rounded-lg border border-violet-500/20 bg-[#150f23] px-3 py-3 text-sm text-slate-100 outline-none transition [color-scheme:dark] focus:border-violet-400 focus:ring-2 focus:ring-violet-500/30"
                  disabled={loadingMetadata}
                  onChange={(event) =>
                    setMetadata((current) => ({
                      ...current,
                      deadline: event.target.value,
                    }))
                  }
                  type="date"
                  value={metadata.deadline}
                />
              </label>

              <div className="md:col-span-2">
                <button
                  className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={loadingMetadata}
                  type="submit"
                >
                  Save Project Settings
                </button>
              </div>
            </form>
          </section>
        ) : (
          <section className="rounded-2xl border border-dashed border-violet-500/30 bg-[#1a1228]/70 p-5 text-sm text-slate-300">
            Admin-only project controls are hidden for users.
          </section>
        )}

        <section className="rounded-2xl border border-violet-500/20 bg-[#1a1228]/90 p-5 shadow-lg shadow-black/20">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-3xl font-semibold text-slate-100">
              Milestones
            </h2>
            {isAdmin ? (
              <button
                className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:bg-violet-500"
                onClick={() => {
                  setIsAddingMilestone((current) => !current);
                  setMilestoneStatus(null);
                  setNewMilestoneTitle("");
                  setNewMilestoneDate("");
                }}
                type="button"
              >
                {isAddingMilestone ? "Cancel" : "Add Milestone"}
              </button>
            ) : null}
          </div>

          <p className="mt-2 text-sm text-slate-400">
            Milestones added here power the dashboard&apos;s next milestone
            card.
          </p>

          {milestoneStatus ? (
            <p className="mt-3 rounded-lg border border-violet-500/20 bg-violet-500/10 px-3 py-2 text-sm text-violet-100">
              {milestoneStatus}
            </p>
          ) : null}

          {isAdmin && isAddingMilestone ? (
            <form
              className="mt-4 grid gap-2 rounded-lg border border-violet-500/20 bg-[#150f23] p-3 md:grid-cols-[1fr_200px_auto]"
              onSubmit={handleAddMilestone}
            >
              <input
                className="rounded-lg border border-violet-500/20 bg-[#1b1430] px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 outline-none transition focus:border-violet-400"
                onChange={(event) => setNewMilestoneTitle(event.target.value)}
                placeholder="Milestone title"
                type="text"
                value={newMilestoneTitle}
                required
              />
              <input
                className="rounded-lg border border-violet-500/20 bg-[#1b1430] px-3 py-2.5 text-sm text-slate-200 outline-none transition [color-scheme:dark] focus:border-violet-400"
                onChange={(event) => setNewMilestoneDate(event.target.value)}
                type="date"
                value={newMilestoneDate}
                required
              />
              <button
                className="rounded-lg border border-violet-500/40 bg-violet-500/20 px-5 py-2.5 text-sm font-semibold text-violet-100 transition hover:bg-violet-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSavingMilestone}
                type="submit"
              >
                {isSavingMilestone ? "Saving..." : "Add"}
              </button>
            </form>
          ) : null}

          <div className="mt-6 border-t border-violet-500/15 pt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Existing Milestones
            </p>

            {loadingMilestones ? (
              <p className="mt-3 text-sm text-slate-400">
                Loading milestones...
              </p>
            ) : milestones.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">No milestones yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {milestones.map((milestone) => (
                  <li
                    key={milestone.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-violet-500/20 bg-[#150f23] px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-100">
                        {milestone.title}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        {toMilestoneLabel(milestone.dueAt)}
                      </p>
                    </div>
                    {isAdmin ? (
                      <button
                        className="rounded-lg border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs font-semibold text-red-200 transition hover:bg-red-500/20"
                        onClick={() => void handleDeleteMilestone(milestone.id)}
                        type="button"
                      >
                        Remove
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-violet-500/20 bg-[#1a1228]/90 p-5 shadow-lg shadow-black/20">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-3xl font-semibold text-slate-100">
              Team Roster
            </h2>
            {isAdmin ? (
              <button
                className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:bg-violet-500"
                onClick={() => {
                  setIsAddingMember((current) => !current);
                  setTeamStatus(null);
                  setNewMemberName("");
                  setNewMemberEmail("");
                }}
                type="button"
              >
                {isAddingMember ? "Cancel" : "Add Member"}
              </button>
            ) : null}
          </div>

          <p className="mt-2 text-sm text-slate-400">
            Invite teammates by email. They are listed here once they accept.
          </p>

          {teamStatus ? (
            <p className="mt-3 rounded-lg border border-violet-500/20 bg-violet-500/10 px-3 py-2 text-sm text-violet-100">
              {teamStatus}
            </p>
          ) : null}

          {isAdmin && isAddingMember ? (
            <form
              className="mt-4 flex flex-wrap gap-2 rounded-lg border border-violet-500/20 bg-[#150f23] p-3"
              onSubmit={handleInviteByEmail}
            >
              <input
                className="min-w-[220px] flex-1 rounded-lg border border-violet-500/20 bg-[#1b1430] px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 outline-none transition focus:border-violet-400"
                onChange={(event) => setNewMemberName(event.target.value)}
                placeholder="Teammate name"
                type="text"
                value={newMemberName}
                required
              />
              <input
                className="min-w-[260px] flex-1 rounded-lg border border-violet-500/20 bg-[#1b1430] px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 outline-none transition focus:border-violet-400"
                onChange={(event) => setNewMemberEmail(event.target.value)}
                placeholder="teammate@school.edu"
                type="email"
                value={newMemberEmail}
                required
              />
              <button
                className="rounded-lg border border-violet-500/40 bg-violet-500/20 px-5 py-2.5 text-sm font-semibold text-violet-100 transition hover:bg-violet-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
                disabled={isSendingInvite}
              >
                {isSendingInvite ? "Sending..." : "Send Invite"}
              </button>
            </form>
          ) : null}

          <div className="mt-6 border-t border-violet-500/15 pt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Existing Members
            </p>

            {loadingMembers ? (
              <p className="mt-3 text-sm text-slate-400">Loading members...</p>
            ) : members.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">No members yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {members.map((member) => (
                  <li
                    key={member.userId}
                    className="flex items-center justify-between gap-3 rounded-lg border border-violet-500/20 bg-[#150f23] px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-100">
                        {member.name || member.email}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        {member.email}
                      </p>
                    </div>
                    <span className="rounded-full border border-violet-500/40 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-200">
                      {member.role}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <div className="flex flex-wrap gap-3">
          <button
            className="rounded-xl border border-red-500/40 px-5 py-3 text-sm font-semibold text-red-300 transition hover:bg-red-500/10"
            onClick={() => void handleLeaveProject()}
            type="button"
          >
            Leave Project
          </button>
          {isAdmin ? (
            <button
              className="rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={deleting}
              onClick={() => void handleDeleteProject()}
              type="button"
            >
              {deleting ? "Deleting..." : "Delete Project"}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
