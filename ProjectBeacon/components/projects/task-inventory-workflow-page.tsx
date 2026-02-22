"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import TaskInventoryBlueprint from "@/components/projects/task-inventory-blueprint";

type PlanningStatus = "draft" | "locked" | "assigned";

type InventoryWorkflowPageProps = {
  projectId: string;
};

function normalizePlanningStatus(value: unknown): PlanningStatus {
  if (value === "locked" || value === "assigned") {
    return value;
  }

  return "draft";
}

function resolveMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const candidate = payload as {
    error?: {
      message?: string;
    };
  };

  if (typeof candidate.error?.message === "string") {
    return candidate.error.message;
  }

  return fallback;
}

export function TaskInventoryWorkflowPage({
  projectId,
}: InventoryWorkflowPageProps) {
  const router = useRouter();
  const [planningStatus, setPlanningStatus] = useState<PlanningStatus>("draft");
  const [taskCount, setTaskCount] = useState(0);
  const [assignedCount, setAssignedCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [isLocking, setIsLocking] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isDelegatingFromInventory, setIsDelegatingFromInventory] =
    useState(false);
  const inventoryRefreshToken = 0;

  const canLock = planningStatus === "draft" && taskCount > 0;
  const canAssign = planningStatus === "locked";

  const loadInventoryState = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    setActionError(null);
    setActionStatus(null);

    try {
      const [projectResponse, boardResponse] = await Promise.all([
        fetch(`/api/projects/${projectId}`, { cache: "no-store" }),
        fetch(`/api/projects/${projectId}/workflow/board`, {
          cache: "no-store",
        }),
      ]);

      const projectPayload = (await projectResponse.json()) as {
        planningStatus?: string;
      };

      if (!projectResponse.ok) {
        throw new Error(
          resolveMessage(projectPayload, "Failed to load planning state."),
        );
      }

      const nextPlanningStatus = normalizePlanningStatus(
        projectPayload.planningStatus,
      );

      let nextTaskCount = 0;
      if (boardResponse.ok) {
        const boardPayload = (await boardResponse.json()) as {
          columns?: Array<{ tasks?: Array<{ id?: string }> }>;
          unassigned?: Array<{ id?: string }>;
        };

        const columnTasks = (boardPayload.columns ?? []).reduce(
          (count, column) =>
            count + (Array.isArray(column.tasks) ? column.tasks.length : 0),
          0,
        );
        const unassignedCount = Array.isArray(boardPayload.unassigned)
          ? boardPayload.unassigned.length
          : 0;

        nextTaskCount = columnTasks + unassignedCount;
      }

      setPlanningStatus(nextPlanningStatus);
      setTaskCount(nextTaskCount);
      setAssignedCount(null);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Failed to load inventory.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadInventoryState();
  }, [loadInventoryState]);

  async function runLock(): Promise<PlanningStatus | null> {
    if (!canLock) {
      return null;
    }

    setIsLocking(true);
    setActionError(null);
    setActionStatus(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/planning/lock`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const payload = (await response.json()) as {
        error?: { message?: string };
        planningStatus?: string;
      };
      if (!response.ok) {
        throw new Error(resolveMessage(payload, "Failed to lock plan."));
      }

      const nextStatus = normalizePlanningStatus(payload.planningStatus);
      setPlanningStatus(nextStatus);
      setActionStatus("Planning status set to locked.");
      return nextStatus;
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Failed to lock planning.",
      );
      return null;
    } finally {
      setIsLocking(false);
    }
  }

  async function runAssign(force = false): Promise<PlanningStatus | null> {
    if (!canAssign) {
      if (!force) {
        return null;
      }
    }

    setIsAssigning(true);
    setActionError(null);
    setActionStatus(null);

    try {
      const response = await fetch(
        `/api/projects/${projectId}/assignments/run`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      const payload = (await response.json()) as {
        assignedCount?: number;
        error?: { message?: string };
        planningStatus?: string;
      };
      if (!response.ok) {
        throw new Error(resolveMessage(payload, "Failed to run assignment."));
      }

      const nextStatus = normalizePlanningStatus(payload.planningStatus);
      setPlanningStatus(nextStatus);
      setAssignedCount(
        typeof payload.assignedCount === "number" ? payload.assignedCount : 0,
      );
      setActionStatus("Assignments generated for current plan.");
      return nextStatus;
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Failed to assign tasks.",
      );
      return null;
    } finally {
      setIsAssigning(false);
    }
  }

  async function handleProceedToDelegationFromInventory() {
    if (isDelegatingFromInventory || isLocking || isAssigning) {
      return;
    }

    setIsDelegatingFromInventory(true);
    setActionError(null);
    setActionStatus(null);

    try {
      if (planningStatus === "draft") {
        const nextStatus = await runLock();
        if (nextStatus === "locked") {
          setActionStatus(
            "Blueprint validated and plan locked. Continue once to run final assignment.",
          );
        }
        return;
      }

      if (planningStatus === "locked") {
        await runAssign(true);
        return;
      }

      setActionStatus("Delegation is already complete for this project.");
    } finally {
      setIsDelegatingFromInventory(false);
    }
  }

  if (isLoading) {
    return (
      <section className="rounded-2xl border border-slate-800 bg-[#0d1018] p-6 shadow-xl">
        <h2 className="text-xl font-semibold text-slate-100">
          Task Inventory Blueprint
        </h2>
        <p className="mt-2 text-sm text-slate-400">Loading inventory...</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="space-y-2 rounded-2xl border border-slate-800 bg-[#0d1018] p-6 shadow-[0_24px_80px_rgba(15,23,42,0.45)]">
        <h2 className="text-4xl font-extrabold tracking-tight text-slate-100">
          Task Inventory Blueprint
        </h2>
        <p className="max-w-2xl text-base text-slate-400">
          Review generated tasks and proceed to delegation.
        </p>

        {loadError ? (
          <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {loadError}
          </p>
        ) : null}
      </div>

      <TaskInventoryBlueprint
        isProceeding={isDelegatingFromInventory || isLocking || isAssigning}
        onProceedToDelegation={handleProceedToDelegationFromInventory}
        planningStatus={planningStatus}
        projectId={projectId}
        refreshToken={inventoryRefreshToken}
      />

      {assignedCount !== null ? (
        <p className="rounded-lg border border-slate-700 bg-[#11121a] px-3 py-2 text-xs text-slate-300">
          Assigned {assignedCount} tasks in the latest run.
        </p>
      ) : null}

      {actionStatus ? (
        <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {actionStatus}
        </p>
      ) : null}

      {actionError ? (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {actionError}
        </p>
      ) : null}

      <div className="flex justify-between">
        <button
          type="button"
          className="rounded-lg border border-slate-600 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700/60"
          onClick={() => router.push(`/projects/${projectId}/clarification`)}
        >
          Back to Clarification
        </button>
      </div>
    </section>
  );
}
