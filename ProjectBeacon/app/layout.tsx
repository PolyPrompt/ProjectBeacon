import {
  ClerkProvider,
  SignInButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";
import type { Metadata } from "next";
import Link from "next/link";

import { BootstrapUser } from "@/components/auth/bootstrap-user";
import { isE2EAuthBypassEnabled } from "@/lib/auth/e2e-bypass";
import "./globals.css";

export const metadata: Metadata = {
  title: "Project Beacon",
  description: "AI-assisted group project planning and assignment",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (isE2EAuthBypassEnabled()) {
    return (
      <html lang="en">
        <body className="antialiased">
          <header className="border-b border-black/10 px-6 py-4">
            <nav className="mx-auto flex w-full max-w-5xl items-center justify-between">
              <Link href="/" className="font-semibold">
                Project Beacon
              </Link>
              <div className="flex items-center gap-4 text-sm">
                <Link href="/projects/new">Projects</Link>
                <Link href="/profile">Profile</Link>
              </div>
            </nav>
          </header>
          {children}
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body className="antialiased">
        <ClerkProvider appearance={{ cssLayerName: "clerk" }}>
          <header className="border-b border-black/10 px-6 py-4">
            <nav className="mx-auto flex w-full max-w-5xl items-center justify-between">
              <Link href="/" className="font-semibold">
                Project Beacon
              </Link>
              <div className="flex items-center gap-4 text-sm">
                <SignedIn>
                  <Link href="/projects/new">Projects</Link>
                  <Link href="/profile">Profile</Link>
                  <UserButton />
                </SignedIn>
                <SignedOut>
                  <SignInButton mode="modal">
                    <button className="rounded border border-black/20 px-3 py-1.5">
                      Sign in
                    </button>
                  </SignInButton>
                </SignedOut>
              </div>
            </nav>
          </header>
          <SignedIn>
            <BootstrapUser />
          </SignedIn>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
