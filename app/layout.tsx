import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { DesktopLayoutShell } from "@/components/desktop-layout-shell";
import { desktopConfig } from "@/lib/config";
import "./globals.css";

export const metadata: Metadata = {
  title: `${desktopConfig.app.name} - Desktop Application`,
  description: desktopConfig.app.description,
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
