import { cp, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const standalone = path.join(".next", "standalone");
const nextDestination = path.join(standalone, ".next", "static");

if (!existsSync(standalone)) {
  console.warn("prepare-desktop: .next/standalone does not exist yet. Run 'next build' first.");
  process.exit(0);
}

// Next intentionally leaves these assets outside standalone output. Electron needs
// them inside the server directory so the packaged app can serve them at runtime.
await rm(nextDestination, { recursive: true, force: true });
await mkdir(path.dirname(nextDestination), { recursive: true });

if (existsSync(path.join(".next", "static"))) {
  await cp(path.join(".next", "static"), nextDestination, { recursive: true });
}

if (existsSync("public")) {
  await cp("public", path.join(standalone, "public"), { recursive: true, force: true });
}
