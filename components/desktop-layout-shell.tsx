"use client";

import { useState } from "react";
import { DesktopTitleBar } from "@/components/desktop-titlebar";
import { CommandPalette } from "@/components/command-palette";
import { ToastContainer } from "@/components/ui/toast";
import { SidebarProvider } from "@/components/ui/sidebar";

export function DesktopLayoutShell({ children }: { children: React.ReactNode }) {
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full flex-col bg-background text-foreground">
        <DesktopTitleBar onOpenCommandPalette={() => setIsCommandPaletteOpen(true)} />
        <div className="flex-1 w-full">{children}</div>
        <CommandPalette
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
        />
        <ToastContainer />
      </div>
    </SidebarProvider>
  );
}
