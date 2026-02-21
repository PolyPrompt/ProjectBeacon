"use client";

import { useState } from "react";

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

export function ProjectForm() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<ProjectResponse | null>(null);
  const [joinLink, setJoinLink] = useState<ProjectJoinLink | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
          deadline: new Date(deadline).toISOString(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data?.error?.message ?? "Failed to create project");
        return;
      }

      setProject(data as ProjectResponse);
      setJoinLink(null);
      setName("");
      setDescription("");
      setDeadline("");
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

  return (
    <div className="w-full rounded border border-black/10 bg-white p-6">
      <form className="space-y-4" onSubmit={onSubmit}>
        <h2 className="text-xl font-semibold">Create Project</h2>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Name</span>
          <input
            className="w-full rounded border border-black/20 px-3 py-2"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Description</span>
          <textarea
            className="w-full rounded border border-black/20 px-3 py-2"
            rows={4}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            required
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Deadline</span>
          <input
            className="w-full rounded border border-black/20 px-3 py-2"
            type="datetime-local"
            value={deadline}
            onChange={(event) => setDeadline(event.target.value)}
            required
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-60"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Creating..." : "Create project"}
        </button>
      </form>

      {project && (
        <div className="mt-6 rounded border border-emerald-200 bg-emerald-50 p-4 text-sm">
          <p className="font-medium">Project created:</p>
          <p>{project.name}</p>
          <p>{new Date(project.deadline).toLocaleString()}</p>
          <p>Status: {project.planningStatus}</p>

          <div className="mt-4 space-y-3">
            <button
              className="rounded border border-black/20 px-3 py-1.5"
              type="button"
              onClick={generateShareLink}
              disabled={isGeneratingLink}
            >
              {isGeneratingLink ? "Generating..." : "Generate share link"}
            </button>

            {joinLink && (
              <div className="space-y-2">
                <p className="break-all">{joinLink.joinUrl}</p>
                <p>Expires: {new Date(joinLink.expiresAt).toLocaleString()}</p>
                <button
                  className="rounded border border-black/20 px-3 py-1.5"
                  type="button"
                  onClick={() =>
                    navigator.clipboard.writeText(joinLink.joinUrl)
                  }
                >
                  Copy link
                </button>
                <ShareEmailForm
                  projectId={project.id}
                  joinUrl={joinLink.joinUrl}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
