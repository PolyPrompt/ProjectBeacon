"use client";

import { usePathname } from "next/navigation";
import { NavBar } from "@/components/navigation/nav-bar";
import type { ProjectRole } from "@/lib/auth/session";

type ProjectNavShellProps = {
  userId: string;
  role: ProjectRole;
  projectId: string;
  onSignOut: () => Promise<void>;
  children: React.ReactNode;
};

export function ProjectNavShell({
  userId,
  role,
  projectId,
  onSignOut,
  children,
}: ProjectNavShellProps) {
  const pathname = usePathname();
  const isStandaloneInventoryRoute = pathname.endsWith("/inventory");
  const isDocumentsRoute = pathname.includes("/documents");
  const isSettingsRoute = pathname.includes("/settings");

  if (isStandaloneInventoryRoute) {
    return <>{children}</>;
  }
  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar
        mode="project"
        onSignOut={onSignOut}
        pathname={pathname}
        projectId={projectId}
        role={role}
        userId={userId}
      />
      <div className="border-b border-slate-200 bg-white/95 backdrop-blur">
        {isDocumentsRoute && role === "user" ? (
          <p className="mx-auto w-full max-w-7xl px-4 pb-3 text-xs font-medium text-slate-500 sm:px-6">
            Documents are in read-only mode for users.
          </p>
        ) : null}
        {isSettingsRoute && role === "user" ? (
          <p className="mx-auto w-full max-w-7xl px-4 pb-3 text-xs font-medium text-slate-500 sm:px-6">
            Settings are in user mode; admin-only controls are hidden.
          </p>
        ) : null}
      </div>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}
