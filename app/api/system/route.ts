import { NextResponse } from "next/server";
import os from "node:os";

export const dynamic = "force-dynamic";

export async function GET() {
  const cpus = os.cpus();
  const uptimeSeconds = Math.floor(process.uptime());
  const freeMemMB = Math.round(os.freemem() / (1024 * 1024));
  const totalMemMB = Math.round(os.totalmem() / (1024 * 1024));

  return NextResponse.json({
    status: "ok",
    message: "Next.js Route Handler running on desktop standalone server",
    runtime: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      processId: process.pid,
      uptimeSeconds,
      cpuModel: cpus[0]?.model ?? "Unknown CPU",
      memory: `${totalMemMB - freeMemMB} MB / ${totalMemMB} MB`,
    },
    timestamp: new Date().toISOString(),
  });
}
