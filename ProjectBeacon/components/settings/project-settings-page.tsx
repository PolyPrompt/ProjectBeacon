"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

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
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
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

  const canDelete = useMemo(
    () => deleteConfirmText === "DELETE",
    [deleteConfirmText],
  );

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
        shareLink?: string;
        url?: string;
      };
      const nextShareLink =
        payload.shareLink ??
        payload.url ??
        `${window.location.origin}/projects/${projectId}?invite=stub`;
      setShareLink(nextShareLink);
      setStatus("Share link generated.");
    } catch (shareError) {
      const fallbackLink = `${window.location.origin}/projects/${projectId}?invite=scaffold`;
      setShareLink(fallbackLink);
      setStatus(
        shareError instanceof Error
          ? `${shareError.message}. Showing fallback share link.`
          : "Could not generate share link from API. Showing fallback share link.",
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
    if (!canDelete || deleting) {
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
    <section className="space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-600">
          Share project access, leave the workspace, and manage admin controls
          safely.
        </p>
      </header>

      {status ? (
        <p className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-800">
          {status}
        </p>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Member Actions</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
            onClick={() => void handleShare()}
            type="button"
          >
            Generate Share Link
          </button>
          <button
            className="rounded-lg border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
            onClick={() => void handleLeaveProject()}
            type="button"
          >
            Leave Project
          </button>
        </div>

        {shareLink ? (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Share Link
            </p>
            <p className="mt-1 break-all text-sm text-slate-800">{shareLink}</p>
          </div>
        ) : null}
      </section>

      {isAdmin ? (
        <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Admin Project Controls
          </h2>

          <form className="space-y-4" onSubmit={handleSaveAdminSettings}>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Project Name
              </span>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Deadline
              </span>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
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

            <button
              className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700"
              disabled={loadingMetadata}
              type="submit"
            >
              Save Project Settings
            </button>
          </form>

          <section className="rounded-xl border border-rose-300 bg-rose-50 p-4">
            <h3 className="text-sm font-semibold text-rose-800">
              Delete Project
            </h3>
            <p className="mt-2 text-sm text-rose-700">
              This is permanent. Type <code>DELETE</code> to confirm.
            </p>
            <input
              className="mt-3 w-full rounded-lg border border-rose-300 px-3 py-2 text-sm"
              onChange={(event) => setDeleteConfirmText(event.target.value)}
              placeholder="Type DELETE"
              type="text"
              value={deleteConfirmText}
            />
            <button
              className="mt-3 rounded-lg border border-rose-400 px-3 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!canDelete || deleting}
              onClick={() => void handleDeleteProject()}
              type="button"
            >
              {deleting ? "Deleting..." : "Delete Project"}
            </button>
          </section>
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600 shadow-sm">
          Admin-only project controls are hidden for users.
        </section>
      )}
    </section>
  );
}
