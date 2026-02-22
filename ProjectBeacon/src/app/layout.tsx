import { ClerkProvider, SignedIn } from "@clerk/nextjs";
import type { Metadata } from "next";

import { BootstrapUser } from "@/components/auth/bootstrap-user";
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
