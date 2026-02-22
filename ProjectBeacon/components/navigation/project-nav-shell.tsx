"use client";

import { usePathname } from "next/navigation";
import { NavBar } from "@/components/navigation/nav-bar";
import type { ProjectRole } from "@/lib/auth/session";

type ProjectNavShellProps = {
  userId: string;
  role: ProjectRole;
  projectId: string;
  onSignOut: () => Promise<void>;
  useClerkUserButton: boolean;
  children: React.ReactNode;
};

export function ProjectNavShell({
  userId,
  role,
  projectId,
  onSignOut,
  useClerkUserButton,
  children,
}: ProjectNavShellProps) {
  const pathname = usePathname();
  const isBoardRoute = pathname.includes("/board");
  const isSettingsRoute = pathname.includes("/settings");
  const rootClassName = isSettingsRoute
    ? "min-h-screen bg-[#120d1c]"
    : "min-h-screen bg-[#18131F]";
  const mainClassName = isBoardRoute
    ? "h-[calc(100vh-73px)] overflow-auto"
    : isSettingsRoute
      ? "min-h-[calc(100vh-73px)]"
      : "mx-auto w-full max-w-7xl px-4 py-6 sm:px-6";
  return (
    <div className={rootClassName}>
      <NavBar
        mode="project"
        onSignOut={onSignOut}
        pathname={pathname}
        projectId={projectId}
        role={role}
        useClerkUserButton={useClerkUserButton}
        userId={userId}
      />

      <main className={mainClassName}>{children}</main>
    </div>
  );
}
