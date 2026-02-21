"use client";

import { SignOutButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { ProjectRole } from "@/types/roles";

type ProjectNavShellProps = {
  userId: string;
  role: ProjectRole;
  projectId: string;
  children: React.ReactNode;
};

type NavItem = {
  label: "Dashboard" | "Documents" | "Board" | "Timeline" | "Settings";
  href: string;
  match: (pathname: string) => boolean;
};

function navItemClass(active: boolean): string {
  return active
    ? "rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white"
    : "rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900";
}

export function ProjectNavShell({
  userId,
  role,
  projectId,
  children,
}: ProjectNavShellProps) {
  const pathname = usePathname();
  const isDocumentsRoute = pathname.includes("/documents");
  const isSettingsRoute = pathname.includes("/settings");

  const navItems: NavItem[] = [
    {
      label: "Dashboard",
      href: `/projects/${projectId}`,
      match: (path) =>
        path === `/projects/${projectId}` || path.endsWith("/workspace"),
    },
    {
      label: "Documents",
      href: `/projects/${projectId}/documents`,
      match: (path) => path.includes("/documents"),
    },
    {
      label: "Board",
      href: `/projects/${projectId}/board`,
      match: (path) => path.includes("/board"),
    },
    {
      label: "Timeline",
      href: `/projects/${projectId}/timeline`,
      match: (path) => path.includes("/timeline"),
    },
    {
      label: "Settings",
      href: `/projects/${projectId}/settings`,
      match: (path) => path.includes("/settings"),
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-sky-600 text-sm font-bold text-white">
              PB
            </div>
            <p className="text-sm font-semibold text-slate-900">
              Project Beacon
            </p>
          </div>

          <nav className="hidden items-center gap-2 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.label}
                className={navItemClass(item.match(pathname))}
                href={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <span className="rounded-full border border-slate-300 px-2.5 py-1 text-xs font-semibold uppercase text-slate-700">
              {role}
            </span>
            <p className="hidden text-xs text-slate-500 sm:block">{userId}</p>
            <SignOutButton redirectUrl="/">
              <button
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                type="button"
              >
                Sign out
              </button>
            </SignOutButton>
          </div>
        </div>
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
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 pb-24 sm:px-6 md:pb-6">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white md:hidden">
        <div className="grid grid-cols-5 gap-1 p-2">
          {navItems.map((item) => (
            <Link
              key={item.label}
              className={navItemClass(item.match(pathname)).replace(
                "rounded-lg",
                "rounded-md",
              )}
              href={item.href}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
