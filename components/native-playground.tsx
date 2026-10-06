"use client";

import { useState } from "react";
import {
  Cpu,
  FolderOpen,
  Bell,
  Volume2,
  Copy,
  ClipboardCheck,
  Sparkles,
  ExternalLink,
  Save,
  MessageSquare,
  Pin,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useIsClient } from "@/lib/utils";
import { isDesktopApp } from "@/lib/db/client";
import { toast } from "@/components/ui/toast";

export function NativePlayground() {
  const isClient = useIsClient();
  const isDesktop = isClient && isDesktopApp();

  // File dialog state
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);

  // Notification state
  const [notifTitle, setNotifTitle] = useState("Task Completed");
  const [notifBody, setNotifBody] = useState("Your background file processing finished successfully.");

  // Clipboard state
  const [clipboardText, setClipboardText] = useState("Hello from Nextron Desktop!");
  const [readClipboardResult, setReadClipboardResult] = useState<string | null>(null);

  // Window state
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false);

  // 1. File Dialogs
  const handleOpenFile = async () => {
    if (!window.desktop?.dialog) {
      toast.info("Web Preview Mode", "Native file dialogs require the desktop Electron runtime.");
      return;
    }
    try {
      const res = await window.desktop.dialog.showOpenDialog({
        title: "Select any file to inspect",
        properties: ["openFile"],
      });
      if (!res.canceled && res.filePaths.length > 0) {
        setSelectedFilePath(res.filePaths[0]);
        toast.success("File Selected", res.filePaths[0].split(/[/\\]/).pop());
      }
    } catch (err) {
      toast.error("File Dialog Error", String(err));
    }
  };

  const handleSaveDialog = async () => {
    if (!window.desktop?.dialog) {
      toast.info("Web Preview Mode", "Native file dialogs require the desktop Electron runtime.");
      return;
    }
    try {
      const res = await window.desktop.dialog.showSaveDialog({
        title: "Save File Demo",
        defaultPath: "my-document.txt",
      });
      if (!res.canceled && res.filePath) {
        toast.success("Save Path Chosen", res.filePath);
      }
    } catch (err) {
      toast.error("Save Dialog Error", String(err));
    }
  };

  const handleMessageBox = async () => {
    if (!window.desktop?.dialog) {
      toast.info("Web Preview Mode", "Native message box requires the desktop Electron runtime.");
      return;
    }
    try {
      const res = await window.desktop.dialog.showMessageBox({
        type: "question",
        title: "Native Desktop Confirmation",
        message: "Do you want to enable automatic desktop sync?",
        detail: "This executes Electron's dialog.showMessageBox directly from your React component.",
        buttons: ["Yes, Enable", "Cancel"],
      });
      toast.info("Dialog Response", `User clicked button index: ${res.response}`);
    } catch (err) {
      toast.error("Dialog Error", String(err));
    }
  };

  // 2. Notifications & Audio
  const handleShowNotification = async () => {
    if (!window.desktop?.notification) {
      toast.info("Web Preview Mode", "OS Notifications require the desktop Electron runtime.");
      return;
    }
    try {
      const ok = await window.desktop.notification.show(notifTitle, notifBody);
      if (ok) {
        toast.success("Notification Sent", "Look at your system notification center!");
      } else {
        toast.error("Notification Not Supported", "System did not accept notification.");
      }
    } catch (err) {
      toast.error("Notification Error", String(err));
    }
  };

  const handleSystemBeep = async () => {
    if (!window.desktop?.shell) {
      toast.info("Web Preview Mode", "System audio beep requires the desktop Electron runtime.");
      return;
    }
    try {
      await window.desktop.shell.beep();
      toast.info("Audio Beep", "Played native OS alert sound.");
    } catch (err) {
      toast.error("Beep Error", String(err));
    }
  };

  // 3. Clipboard
  const handleWriteClipboard = async () => {
    try {
      if (window.desktop?.clipboard) {
        await window.desktop.clipboard.writeText(clipboardText);
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(clipboardText);
      }
      toast.success("Copied to Clipboard", clipboardText);
    } catch (err) {
      toast.error("Clipboard Error", String(err));
    }
  };

  const handleReadClipboard = async () => {
    try {
      let text = "";
      if (window.desktop?.clipboard) {
        text = await window.desktop.clipboard.readText();
      } else if (navigator.clipboard) {
        text = await navigator.clipboard.readText();
      }
      setReadClipboardResult(text || "(Clipboard is empty)");
      toast.info("Read from Clipboard", text ? `${text.length} characters` : "Empty");
    } catch (err) {
      toast.error("Clipboard Read Error", String(err));
    }
  };

  // 4. Window Management
  const handleTogglePin = async () => {
    if (!window.desktop?.window) {
      toast.info("Web Preview Mode", "Window pinning requires the desktop Electron runtime.");
      return;
    }
    try {
      const next = !isAlwaysOnTop;
      const res = await window.desktop.window.setAlwaysOnTop(next);
      setIsAlwaysOnTop(res);
      toast.success(res ? "Window Pinned" : "Window Unpinned", res ? "Always on top active" : "Normal window layering");
    } catch (err) {
      toast.error("Pinning Error", String(err));
    }
  };

  const handleRevealDbFolder = async () => {
    if (!window.desktop?.shell || !window.desktop?.db) {
      toast.info("Web Preview Mode", "File explorer opening requires the desktop Electron runtime.");
      return;
    }
    try {
      const filePath = await window.desktop.db.getFilePath();
      await window.desktop.shell.showItemInFolder(filePath);
      toast.success("Revealed in Explorer", filePath);
    } catch (err) {
      toast.error("Action Error", String(err));
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="flex flex-col gap-2 rounded-2xl border border-primary/20 bg-primary/5 p-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Cpu className="size-5 text-primary" /> Native OS Capabilities Playground
          </h2>
          <p className="text-xs text-muted-foreground max-w-2xl">
            Test real operating system features through the secure <code>window.desktop</code> bridge. Notice how these features work without exposing dangerous Node integration to the frontend.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
              isDesktop ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-muted text-muted-foreground"
            }`}
          >
            <CheckCircle2 className="size-3.5" />
            {isDesktop ? "Native Desktop Active" : "Web Preview Mode"}
          </span>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Card 1: Native File Dialogs */}
        <Card className="border border-border/80 bg-card/70 backdrop-blur-md">
          <CardHeader>
            <div className="flex size-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400">
              <FolderOpen className="size-5" />
            </div>
            <CardTitle className="mt-2 text-base">Native File System Dialogs</CardTitle>
            <CardDescription className="text-xs">
              Open file selection, save path prompt, and OS confirmation message boxes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={handleOpenFile}>
                <FolderOpen className="size-3.5 mr-1.5 text-sky-400" /> Open File Dialog
              </Button>
              <Button variant="outline" size="sm" onClick={handleSaveDialog}>
                <Save className="size-3.5 mr-1.5 text-primary" /> Save File Dialog
              </Button>
            </div>

            <Button variant="outline" size="sm" className="w-full" onClick={handleMessageBox}>
              <MessageSquare className="size-3.5 mr-1.5 text-amber-400" /> Native Message Box Alert
            </Button>

            {selectedFilePath && (
              <div className="rounded-lg bg-muted/60 p-2.5 text-xs font-mono border border-border/40 space-y-1">
                <span className="text-muted-foreground block text-[10px]">Selected File Path:</span>
                <span className="text-foreground font-semibold break-all select-text">{selectedFilePath}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 2: Native Notifications & Sound */}
        <Card className="border border-border/80 bg-card/70 backdrop-blur-md">
          <CardHeader>
            <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
              <Bell className="size-5" />
            </div>
            <CardTitle className="mt-2 text-base">Notifications & System Audio</CardTitle>
            <CardDescription className="text-xs">
              Trigger real OS desktop notification banners and system alert beeps.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <input
                type="text"
                className="w-full rounded-lg border border-input bg-background/80 px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground select-text"
                placeholder="Notification Title..."
                value={notifTitle}
                onChange={(e) => setNotifTitle(e.target.value)}
              />
              <input
                type="text"
                className="w-full rounded-lg border border-input bg-background/80 px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground select-text"
                placeholder="Notification Body..."
                value={notifBody}
                onChange={(e) => setNotifBody(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" onClick={handleShowNotification}>
                <Bell className="size-3.5 mr-1.5" /> Trigger Notification
              </Button>
              <Button variant="outline" size="sm" onClick={handleSystemBeep}>
                <Volume2 className="size-3.5 mr-1.5 text-amber-500" /> System Beep
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Native Clipboard */}
        <Card className="border border-border/80 bg-card/70 backdrop-blur-md">
          <CardHeader>
            <div className="flex size-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
              <Copy className="size-5" />
            </div>
            <CardTitle className="mt-2 text-base">OS Clipboard Bridge</CardTitle>
            <CardDescription className="text-xs">
              Interact directly with the native operating system clipboard via Electron IPC.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 rounded-lg border border-input bg-background/80 px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring select-text"
                value={clipboardText}
                onChange={(e) => setClipboardText(e.target.value)}
              />
              <Button size="sm" onClick={handleWriteClipboard}>
                <Copy className="size-3.5 mr-1.5" /> Copy
              </Button>
            </div>

            <Button variant="outline" size="sm" className="w-full" onClick={handleReadClipboard}>
              <ClipboardCheck className="size-3.5 mr-1.5 text-purple-400" /> Read Current Clipboard Text
            </Button>

            {readClipboardResult && (
              <div className="rounded-lg bg-muted/60 p-2.5 text-xs font-mono border border-border/40 space-y-1">
                <span className="text-muted-foreground block text-[10px]">Clipboard Contents:</span>
                <span className="text-foreground font-semibold break-all select-text">{readClipboardResult}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 4: Window Pinning & Shell */}
        <Card className="border border-border/80 bg-card/70 backdrop-blur-md">
          <CardHeader>
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <Sparkles className="size-5" />
            </div>
            <CardTitle className="mt-2 text-base">Window Controls & Shell</CardTitle>
            <CardDescription className="text-xs">
              Pin window on top of all applications, or reveal application assets in system explorer.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={isAlwaysOnTop ? "default" : "outline"}
                size="sm"
                onClick={handleTogglePin}
              >
                <Pin className={`size-3.5 mr-1.5 ${isAlwaysOnTop ? "rotate-45" : ""}`} />
                {isAlwaysOnTop ? "Always On Top: ON" : "Pin Always On Top"}
              </Button>

              <Button variant="outline" size="sm" onClick={handleRevealDbFolder}>
                <FolderOpen className="size-3.5 mr-1.5 text-sky-400" /> Reveal db.json
              </Button>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => window.desktop?.openExternal("https://github.com/codeXnitro/nextron")}
            >
              <ExternalLink className="size-3.5 mr-1.5" /> Open GitHub Repository in Browser
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
