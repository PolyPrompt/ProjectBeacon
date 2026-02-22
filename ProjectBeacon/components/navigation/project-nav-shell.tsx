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
  const isBoardRoute = pathname.includes("/board");
  const isDocumentsRoute = pathname.includes("/documents");
  const isSettingsRoute = pathname.includes("/settings");
  const rootClassName = isSettingsRoute
    ? "min-h-screen bg-[#120d1c]"
    : "min-h-screen bg-[#18131F]";
  const mainClassName = isSettingsRoute
    ? "min-h-[calc(100vh-73px)]"
    : "mx-auto w-full max-w-7xl px-4 py-6 sm:px-6";
  const routeNotice =
    role === "user" && isDocumentsRoute
      ? "Documents are in read-only mode for users."
      : role === "user" && isSettingsRoute
        ? "Settings are in user mode; admin-only controls are hidden."
        : null;

  if (isStandaloneInventoryRoute) {
    return <>{children}</>;
  }

  if (isBoardRoute) {
    return <main className="min-h-screen">{children}</main>;
  }
  return (
    <div className={rootClassName}>
      <NavBar
        mode="project"
        onSignOut={onSignOut}
        pathname={pathname}
        projectId={projectId}
        role={role}
        userId={userId}
      />
      {routeNotice ? (
        <div className="border-b border-slate-200 bg-white/95 backdrop-blur">
          <p className="mx-auto w-full max-w-7xl px-4 pb-3 text-xs font-medium text-slate-500 sm:px-6">
            {routeNotice}
          </p>
        </div>
      ) : null}

      <main className={mainClassName}>{children}</main>
    </div>
  );
}
