"use client";

import { useEffect, useState } from "react";

type SendResult = {
  projectId: string;
  sent: Array<{ email: string; status: "sent" }>;
  failed: Array<{ email: string; reason: string }>;
};

export function ShareEmailForm({
  projectId,
  joinUrl,
  suggestedEmails = [],
}: {
  projectId: string;
  joinUrl: string;
  suggestedEmails?: string[];
}) {
  const [emailsInput, setEmailsInput] = useState("");
  const [result, setResult] = useState<SendResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (emailsInput.length > 0 || suggestedEmails.length === 0) {
      return;
    }

    setEmailsInput(suggestedEmails.join("\n"));
  }, [emailsInput.length, suggestedEmails]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);
    setIsSending(true);

    try {
      const emails = emailsInput
        .split(/[\n,]/)
        .map((entry) => entry.trim())
        .filter(Boolean);

      const response = await fetch(`/api/projects/${projectId}/share-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          emails,
          joinUrl,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data?.error?.message ?? "Failed to send invite emails");
        return;
      }

      setResult(data as SendResult);
      setEmailsInput("");
    } catch {
      setError("Failed to send invite emails");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <h3 className="text-sm font-semibold">Share by Email</h3>
      <textarea
        className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm"
        rows={3}
        placeholder="teammate1@school.edu, teammate2@school.edu"
        value={emailsInput}
        onChange={(event) => setEmailsInput(event.target.value)}
        required
      />
      <button
        className="rounded-lg border border-black/20 px-3 py-1.5 text-sm font-medium"
        type="submit"
        disabled={isSending}
      >
        {isSending ? "Sending..." : "Send invites"}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && (
        <div className="text-sm">
          <p>
            Sent: {result.sent.length} · Failed: {result.failed.length}
          </p>
          {result.failed.length > 0 && (
            <ul className="mt-2 list-disc pl-5">
              {result.failed.map((item) => (
                <li key={`${item.email}-${item.reason}`}>
                  {item.email}: {item.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
