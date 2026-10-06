import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { DesktopLayoutShell } from "@/components/desktop-layout-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nextron - Desktop Kit for Next.js 16 & Electron",
  description: "A production-ready desktop framework with Next.js 16, Electron, and real-time JSON database.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>
          <DesktopLayoutShell>{children}</DesktopLayoutShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
