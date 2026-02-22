"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type JoinResult = {
  projectId: string;
};

export function JoinProjectClient({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function joinProject() {
      try {
        const response = await fetch(`/api/join/${encodeURIComponent(token)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const data = (await response.json()) as
          | JoinResult
          | { error?: { message?: string } };

        if (!response.ok) {
          if (!cancelled) {
            setError(
              "error" in data && data.error?.message
                ? data.error.message
                : "Unable to join this project.",
            );
          }
          return;
        }

        if (
          !cancelled &&
          "projectId" in data &&
          typeof data.projectId === "string"
        ) {
          router.replace(`/projects/${data.projectId}/skills`);
        }
      } catch {
        if (!cancelled) {
          setError("Unable to join this project.");
        }
      }
    }

    void joinProject();

    return () => {
      cancelled = true;
    };
  }, [router, token]);

  if (error) {
    return (
      <main className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col items-start justify-center gap-4 px-6">
        <h1 className="text-2xl font-bold">Unable to join project</h1>
        <p className="text-black/70">{error}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col items-start justify-center gap-4 px-6">
      <h1 className="text-2xl font-bold">Joining project...</h1>
      <p className="text-black/70">
        We are adding you to the project and preparing your skills setup.
      </p>
    </main>
  );
}
