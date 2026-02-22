"use client";

import { UserButton } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import type { ProjectRole } from "@/lib/auth/session";

type ProjectNavBarProps = {
  mode: "project";
  userId: string;
  role: ProjectRole;
  projectId: string;
  pathname: string;
  hideNavigation?: boolean;
  onSignOut: () => Promise<void>;
  useClerkUserButton: boolean;
};

type PublicNavBarProps = {
  mode: "public";
  pathname: string;
};

type NavBarProps = ProjectNavBarProps | PublicNavBarProps;

type NavItem = {
  label: "Dashboard" | "Documents" | "Board" | "Settings";
  href: string;
  match: (pathname: string) => boolean;
};

function navLinkClass(active: boolean): string {
  return active
    ? "relative px-1 py-2 text-sm font-medium text-slate-100 after:absolute after:-bottom-0.5 after:left-0 after:h-0.5 after:w-full after:rounded-full after:bg-violet-500"
    : "px-1 py-2 text-sm font-medium text-slate-400 transition-colors hover:text-slate-200";
}

function getUserInitials(userId: string): string {
  const trimmed = userId.trim();

  if (trimmed.length <= 2) {
    return trimmed.toUpperCase();
  }

  return trimmed.slice(0, 2).toUpperCase();
}

export function NavBar(props: NavBarProps) {
  const pathname = props.pathname;
  const hideNavigation =
    props.mode === "project" && props.hideNavigation === true;

  const brandHref = "/projects";
  let userInitials = "";
  let navItems: NavItem[] = [
    {
      label: "Dashboard",
      href: "/",
      match: (path) => path === "/",
    },
    {
      label: "Documents",
      href: "/projects/new",
      match: () => false,
    },
    {
      label: "Board",
      href: "/projects/new",
      match: () => false,
    },
    {
      label: "Settings",
      href: "/projects/new",
      match: () => false,
    },
  ];

  if (props.mode === "project") {
    userInitials = getUserInitials(props.userId);
    navItems = [
      {
        label: "Dashboard",
        href: `/projects/${props.projectId}`,
        match: (path) =>
          path === `/projects/${props.projectId}` ||
          path.endsWith("/workspace"),
      },
      {
        label: "Documents",
        href: `/projects/${props.projectId}/documents`,
        match: (path) => path.includes("/documents"),
      },
      {
        label: "Board",
        href: `/projects/${props.projectId}/board`,
        match: (path) =>
          path.includes("/userflow/board") || path.includes("/board"),
      },
      {
        label: "Settings",
        href: `/projects/${props.projectId}/settings`,
        match: (path) => path.includes("/settings"),
      },
    ];
  }

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[linear-gradient(90deg,#16112B_0%,#17142F_45%,#12172E_100%)]">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link
          className="flex items-center gap-2 text-slate-100 transition-opacity hover:opacity-90"
          href={brandHref}
        >
          <Image
            alt="TaskLogger beaver logo"
            height={24}
            priority
            src="/beaver.png"
            width={24}
          />
          <span className="text-xl font-semibold leading-none sm:text-3xl">
            TaskLogger
          </span>
        </Link>

        {hideNavigation ? null : (
          <nav className="hidden items-center gap-10 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.label}
                className={navLinkClass(item.match(pathname))}
                href={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-3">
          {props.mode === "public" ? (
            <Link
              className="rounded-full border border-violet-300/50 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-100 transition-colors hover:bg-white/10"
              href="/sign-in"
            >
              Sign in
            </Link>
          ) : (
            <>
              <span className="hidden rounded-full border border-violet-300/40 bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-violet-100 sm:inline-block">
                {props.role}
              </span>
              {props.useClerkUserButton ? (
                <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-full border border-violet-300/50 bg-white/5">
                  <UserButton
                    afterSignOutUrl="/sign-in"
                    appearance={{
                      elements: {
                        avatarBox: "h-10 w-10",
                        userButtonTrigger:
                          "h-10 w-10 rounded-full border-0 bg-transparent shadow-none hover:bg-white/10",
                      },
                    }}
                  />
                </div>
              ) : (
                <form action={props.onSignOut}>
                  <button
                    aria-label="Sign out"
                    className="grid h-10 w-10 place-items-center rounded-full border border-violet-300/50 bg-white/5 text-xs font-semibold text-slate-100 transition-colors hover:bg-white/10"
                    title="Sign out"
                    type="submit"
                  >
                    {userInitials}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>

      {hideNavigation ? null : (
        <nav className="border-t border-white/10 px-4 py-2 md:hidden">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 overflow-x-auto whitespace-nowrap">
            {navItems.map((item) => (
              <Link
                key={item.label}
                className={navLinkClass(item.match(pathname))}
                href={item.href}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
