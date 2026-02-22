"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type ProjectSettingsPageProps = {
  projectId: string;
  role: "admin" | "user";
};

type ProjectMetadata = {
  name: string;
  deadline: string;
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

export function ProjectSettingsPage({
  projectId,
  role,
}: ProjectSettingsPageProps) {
  const router = useRouter();
  const isAdmin = role === "admin";
  const [metadata, setMetadata] = useState<ProjectMetadata>(DEFAULT_METADATA);
  const [loadingMetadata, setLoadingMetadata] = useState(isAdmin);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deadlineInputRef = useRef<HTMLInputElement | null>(null);

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

  async function handleShare() {
    try {
      setStatus(null);
      const response = await fetch(`/api/projects/${projectId}/share-link`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(`Share-link request returned ${response.status}`);
      }

      const payload = (await response.json()) as {
        joinUrl?: string;
      };
      if (!payload.joinUrl) {
        throw new Error("Share-link response missing joinUrl.");
      }

      setShareLink(payload.joinUrl);
      setStatus("Share link generated.");
    } catch (shareError) {
      setShareLink(null);
      setStatus(
        shareError instanceof Error
          ? shareError.message
          : "Could not generate share link from API.",
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

  function openDeadlinePicker() {
    if (loadingMetadata || !deadlineInputRef.current) {
      return;
    }

    const input = deadlineInputRef.current as HTMLInputElement & {
      showPicker?: () => void;
    };
    input.focus();
    input.showPicker?.();
  }

  return (
    <section className="min-h-[calc(100vh-120px)] space-y-6 rounded-3xl border border-violet-500/20 bg-[#120d1c] p-6 shadow-[0_24px_90px_rgba(8,4,20,0.5)]">
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
              <div className="relative">
                <input
                  ref={deadlineInputRef}
                  className="w-full rounded-lg border border-violet-500/20 bg-[#150f23] px-3 py-3 pr-12 text-sm text-slate-100 outline-none transition [color-scheme:dark] focus:border-violet-400 focus:ring-2 focus:ring-violet-500/30"
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
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-violet-500/20 bg-violet-500/10 px-2 py-1 text-xs text-violet-200 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={openDeadlinePicker}
                  disabled={loadingMetadata}
                  aria-label="Open calendar"
                >
                  📅
                </button>
              </div>
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
          <h2 className="text-3xl font-semibold text-slate-100">Team Roster</h2>
          <button
            className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:bg-violet-500"
            onClick={() => void handleShare()}
            type="button"
          >
            Add Member
          </button>
        </div>

        <p className="mt-2 text-sm text-slate-400">
          Generate a secure invite link and share it with teammates.
        </p>

        {shareLink ? (
          <div className="mt-4 rounded-lg border border-violet-500/20 bg-[#150f23] p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Share Link
            </p>
            <p className="mt-1 break-all text-sm text-violet-100">
              {shareLink}
            </p>
          </div>
        ) : null}

        <div className="mt-6 border-t border-violet-500/15 pt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Add New Member
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              className="min-w-[260px] flex-1 rounded-lg border border-violet-500/20 bg-[#150f23] px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 outline-none"
              disabled
              placeholder="Search by name or email..."
              type="text"
            />
            <button
              className="rounded-lg border border-violet-500/30 bg-violet-500/20 px-5 py-2.5 text-sm font-semibold text-violet-200 transition hover:bg-violet-500/30"
              onClick={() => void handleShare()}
              type="button"
            >
              Add
            </button>
          </div>
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
    </section>
  );
}
