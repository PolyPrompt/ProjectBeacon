import { ClerkProvider, SignedIn } from "@clerk/nextjs";
import type { Metadata } from "next";

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
        <body className="antialiased">{children}</body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body className="antialiased">
        <ClerkProvider appearance={{ cssLayerName: "clerk" }}>
          <SignedIn>
            <BootstrapUser />
          </SignedIn>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
