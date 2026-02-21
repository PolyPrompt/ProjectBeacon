"use client";

import { useMemo, useState } from "react";

import { DependencyPreview } from "@/components/dashboard/dependency-preview";
import { ProjectMembersList } from "@/components/dashboard/project-members-list";
import { ProjectSummaryCard } from "@/components/dashboard/project-summary-card";
import { ProjectTaskList } from "@/components/dashboard/project-task-list";
import { PlanningWorkspace } from "@/components/projects/planning-workspace";
import {
  DependencyEdge,
  PlanningWorkspaceState,
  ProjectDashboardViewModel,
  ProjectPlanningStatus,
  ProjectSummary,
  ProjectTask,
} from "@/types/dashboard";

type ProjectDashboardShellProps = {
  initialViewModel: ProjectDashboardViewModel;
  initialWorkspaceState: PlanningWorkspaceState;
  initialProjectDescription: string;
};

export function ProjectDashboardShell({
  initialViewModel,
  initialWorkspaceState,
  initialProjectDescription,
}: ProjectDashboardShellProps) {
  const [project, setProject] = useState<ProjectSummary>(initialViewModel.project);
  const [tasks, setTasks] = useState<ProjectTask[]>(initialViewModel.tasks);
  const [dependencyEdges, setDependencyEdges] = useState<DependencyEdge[]>(initialViewModel.dependencyEdges);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const memberCountLabel = useMemo(() => `${initialViewModel.members.length} members`, [initialViewModel.members.length]);

  const handleShare = async () => {
    const shareText = `${window.location.origin}/join/${project.id}`;

    try {
      await navigator.clipboard.writeText(shareText);
      setCopyMessage("Share link copied.");
    } catch {
      setCopyMessage("Clipboard unavailable. Copy from address bar.");
    }

    window.setTimeout(() => {
      setCopyMessage(null);
    }, 2400);
  };

  const handleTasksChange = (nextTasks: ProjectTask[], nextDependencyEdges: DependencyEdge[]) => {
    setTasks(nextTasks);
    setDependencyEdges(nextDependencyEdges);
  };

  const handlePlanningStatusChange = (nextStatus: ProjectPlanningStatus) => {
    setProject((prevProject) => ({ ...prevProject, planningStatus: nextStatus }));
  };

  return (
    <div className="space-y-6">
      <ProjectSummaryCard onShare={handleShare} project={project} />

      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span>{memberCountLabel}</span>
        {copyMessage ? <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-600">{copyMessage}</span> : null}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ProjectMembersList members={initialViewModel.members} />
        <ProjectTaskList members={initialViewModel.members} tasks={tasks} />
        <DependencyPreview dependencyEdges={dependencyEdges} tasks={tasks} />
      </div>

      <PlanningWorkspace
        initialDependencyEdges={dependencyEdges}
        initialProjectDescription={initialProjectDescription}
        initialState={initialWorkspaceState}
        initialTasks={tasks}
        planningStatus={project.planningStatus}
        projectId={project.id}
        onPlanningStatusChange={handlePlanningStatusChange}
        onTasksChange={handleTasksChange}
      />
    </div>
  );
}
