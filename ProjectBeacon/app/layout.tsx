import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Project Beacon",
  description: "Project planning and task delegation workspace.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
