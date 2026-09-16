"use server";

import os from "node:os";

export type ServerActionResult = {
  success: boolean;
  echoMessage: string;
  processedAt: string;
  serverHostname: string;
  serverPid: number;
};

export async function executeDesktopServerAction(message: string): Promise<ServerActionResult> {
  const sanitized = (message || "Empty message").trim().slice(0, 100);

  return {
    success: true,
    echoMessage: `Server Action processed: "${sanitized}"`,
    processedAt: new Date().toLocaleTimeString(),
    serverHostname: os.hostname(),
    serverPid: process.pid,
  };
}
