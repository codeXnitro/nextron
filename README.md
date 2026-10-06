# Nextron 🚀

> **Turn your Next.js skills into production-grade desktop applications.**  
> A state-of-the-art desktop framework powered by **Next.js 16 (App Router)**, **Electron 37**, **shadcn/ui**, **Tailwind CSS 4**, and an all-in-one **real-time JSON database**.

If you know how to build modern web apps with Next.js and React, you can build native desktop software with Nextron today. Write standard Next.js code—Nextron packages it into a native Windows (`.exe`), macOS (`.dmg`), or Linux (`.deb`) installer with a single command.

Unlike conventional Electron starters that require static exports (`output: 'export'`), Nextron runs a **self-contained standalone Next.js server** inside the packaged application. That means **Route Handlers (`/api/...`)**, **Server Actions (`"use server"`)**, **Node.js APIs**, and the **built-in real-time database** all work both in local development **and** in your distributed desktop installer.

---

## ✨ Features & Highlights

- ⚡ **Next.js 16 (App Router + Fast HMR)**: Build with modern React 19 patterns. Child components, routes, and layout changes reflect instantly without restarting.
- 🗄️ **Advanced Real-Time JSON Database**: Zero-dependency, atomic, cross-process storage with MongoDB-style query filters (`$gt`, `$lt`, `$in`, `$contains`, `$regex`), sorting, pagination, batch operations (`insertMany`, `deleteMany`), CSV/JSON export & import, automated backups, and Windows file-lock recovery.
- 🪟 **Custom Frameless Title Bar**: Native drag regions (`app-drag` / `app-no-drag`), cross-platform minimize, maximize/restore, and close buttons on Windows/Linux, and native traffic lights on macOS.
- 🔍 **Raycast-Style Command Palette (`Cmd+K` / `Ctrl+K`)**: Instant search across views, database commands, native actions, and theme toggling.
- 🖥️ **Full Native Desktop Bridge (`window.desktop`)**:
  - **Window Controls**: Minimize, maximize, close, pin always-on-top, and maximize state sync.
  - **Native Dialogs**: Open file/folder pickers, save dialogs, and OS message boxes.
  - **OS Notifications & Audio**: Native desktop notification banners and system alert beeps.
  - **OS Clipboard**: Read and write system clipboard text seamlessly.
  - **Shell Integration**: Reveal files in Explorer/Finder, open external links, and execute safe shell operations.
  - **Bidirectional Theme Sync**: Synchronizes React theme with Electron's `nativeTheme.themeSource`.
- 📊 **Database Studio & Native OS Playground**: Interactive, visual desktop tools to inspect live collections, run queries, test OS features, and benchmark Server Actions.
- 🔒 **Secure by Default**: Context isolation enabled, Node integration disabled in the renderer, safe preload IPC bridge.
- 📦 **Electron Forge Packaging**: Optimized ASAR bundling, Squirrel Windows installers, macOS DMG/ZIP, and Debian packages.

---

## 🏁 Quick Start (5 Minutes)

### Prerequisites

- [Node.js](https://nodejs.org/) version `20.9` or higher (includes `npm`).

### 1. Clone and Install

```bash
# 1. Clone the repository
git clone https://github.com/codeXnitro/nextron.git my-desktop-app

# 2. Navigate to the project directory
cd my-desktop-app

# 3. Install dependencies
npm install
```

### 2. Start Developing

```bash
npm run dev
```

This starts the Next.js local server and automatically launches the Electron desktop window with **instant live hot-reloading**. Edit any file and watch changes update immediately.

> 💡 **Prefer testing in a browser?** Run `npm run dev:web` and navigate to `http://localhost:3000`. Native desktop features will gracefully fall back to web modes, while the real-time database and server actions remain fully functional.

---

## ⌨️ Desktop Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Ctrl+K` or `⌘K` | Open Raycast-style Command Palette |
| `ESC` | Close Command Palette or modal dialogs |
| `Ctrl+R` or `⌘R` | Reload desktop window |
| `Ctrl+Shift+I` or `⌥⌘I` | Toggle Chromium Developer Tools (in development) |

---

## 🧭 Project Map — Where Do I Edit?

| What do you want to build? | Edit this file |
| :--- | :--- |
| **Main Screen & Dashboard** | [`app/page.tsx`](app/page.tsx) |
| **Add a New Route Page** | Create `app/my-page/page.tsx` |
| **Custom Title Bar & Controls** | [`components/desktop-titlebar.tsx`](components/desktop-titlebar.tsx) |
| **Command Palette Actions** | [`components/command-palette.tsx`](components/command-palette.tsx) |
| **Database Studio Interface** | [`components/database-studio.tsx`](components/database-studio.tsx) |
| **Native OS Playground** | [`components/native-playground.tsx`](components/native-playground.tsx) |
| **React Database Hooks** | `import { useDatabase, useDocument, useKeyValue } from "@/lib/db/client"` |
| **Server-Side Database & Actions** | `import { db } from "@/lib/db"` in [`app/actions/`](app/actions/) |
| **Native Desktop IPC Bridge** | [`electron/preload.cjs`](electron/preload.cjs) + [`electron/main.cjs`](electron/main.cjs) |
| **App Name, Executable, & Installer** | [`forge.config.cjs`](forge.config.cjs) + [`package.json`](package.json) |

---

## 🗄️ Real-Time JSON Database SDK

Nextron includes an atomic, zero-config JSON database stored as `data/db.json`. It is shared concurrently across the **Electron Main process**, the **Next.js Standalone server**, and the **React Client renderer**.

### 1. In React Client Components (`useDatabase`)

```tsx
"use client";

import { useDatabase } from "@/lib/db/client";

interface Note {
  id: string;
  title: string;
  priority: "low" | "medium" | "high";
  createdAt: string;
  updatedAt: string;
}

export function NotesView() {
  // Query with filters, sorting, and pagination
  const { data: notes, loading, insert, update, remove } = useDatabase<Note>(
    "notes",
    { priority: "high" },           // Filter (optional)
    { sort: "createdAt", order: "desc" } // Sorting (optional)
  );

  if (loading) return <p>Loading notes...</p>;

  return (
    <div>
      <button onClick={() => insert({ title: "Urgent Meeting", priority: "high" })}>
        Add Note
      </button>
      {notes.map((n) => (
        <div key={n.id}>
          <span>{n.title}</span>
          <button onClick={() => remove(n.id)}>Delete</button>
        </div>
      ))}
    </div>
  );
}
```

### 2. Single Document Subscription (`useDocument`)

```tsx
"use client";

import { useDocument } from "@/lib/db/client";

export function ActiveTaskCard({ taskId }: { taskId: string }) {
  const { document: task, loading, update } = useDocument("tasks", taskId);

  if (loading) return <span>Loading task...</span>;
  if (!task) return <span>Task not found</span>;

  return (
    <div>
      <h3>{task.title}</h3>
      <button onClick={() => update({ completed: !task.completed })}>
        Toggle Complete
      </button>
    </div>
  );
}
```

### 3. Key-Value Storage Hook (`useKeyValue`)

For single values such as app preferences, tokens, or active filters:

```tsx
"use client";

import { useKeyValue } from "@/lib/db/client";

export function AccentColorPicker() {
  const [accent, setAccent, loading] = useKeyValue<string>("userAccentColor", "violet");

  return (
    <select value={accent} onChange={(e) => setAccent(e.target.value)}>
      <option value="violet">Violet</option>
      <option value="emerald">Emerald</option>
      <option value="amber">Amber</option>
    </select>
  );
}
```

### 4. Advanced Query Filtering Operators

The engine supports MongoDB-style query operators:

```ts
// Greater than / Less than
db.collection("products").find({ price: { $gt: 100, $lte: 500 } });

// In / Not in
db.collection("tasks").find({ status: { $in: ["todo", "in_progress"] } });

// Case-insensitive substring match
db.collection("users").find({ email: { $contains: "@company.com" } });

// Full-text search across all record fields
db.collection("articles").find({ _search: "electron desktop" });

// Sorting and pagination
db.collection("logs").find(
  { level: "error" },
  { sort: "timestamp", order: "desc", limit: 25, page: 1 }
);
```

### 5. Server Actions & Backend Usage

```ts
// app/actions/notes.ts
"use server";

import { db } from "@/lib/db";

export async function createNote(title: string) {
  const note = await db.collection("notes").insert({
    title,
    createdAt: new Date().toISOString(),
  });
  return { success: true, note };
}

export async function backupDatabase() {
  const backupPath = await db.backup();
  return { success: true, backupPath };
}
```

---

## 🖥️ Native Desktop Bridge (`window.desktop`)

The secure preload bridge provides full OS capabilities:

```ts
// Window Controls
await window.desktop?.window.minimize();
await window.desktop?.window.toggleMaximize();
await window.desktop?.window.setAlwaysOnTop(true);
await window.desktop?.window.close();

// Native Dialogs
const { filePaths, canceled } = await window.desktop?.dialog.showOpenDialog({
  properties: ["openFile"],
  filters: [{ name: "Images", extensions: ["png", "jpg"] }],
});

const { filePath } = await window.desktop?.dialog.showSaveDialog({
  defaultPath: "export.json",
});

await window.desktop?.dialog.showMessageBox({
  type: "info",
  title: "Export Ready",
  message: "Your data has been exported successfully.",
});

// Native OS Notifications & Sound
await window.desktop?.notification.show("Build Complete", "Your desktop app is ready.");
await window.desktop?.shell.beep();

// Native OS Clipboard
await window.desktop?.clipboard.writeText("Copied from Nextron!");
const text = await window.desktop?.clipboard.readText();

// Shell & File Manager
await window.desktop?.shell.showItemInFolder("C:/path/to/data/db.json");
await window.desktop?.shell.openExternal("https://nextjs.org");
```

---

## 📦 Packaging & Distributable Installers

When your application is ready to ship:

### Step 1: Update metadata in `package.json`

```json
{
  "name": "my-cool-app",
  "version": "1.0.0",
  "description": "My flagship desktop application",
  "author": "Your Name <you@example.com>"
}
```

### Step 2: Build and create platform installers

```bash
npm run make
```

This single command:
1. Runs TypeScript typechecking (`tsc --noEmit`)
2. Runs ESLint analysis (`eslint .`)
3. Builds the optimized Next.js standalone bundle (`next build`)
4. Prepares standalone desktop assets (`prepare-desktop.mjs`)
5. Creates platform-native installers with **Electron Forge**

### Step 3: Output Distributables

Find your generated installers in `out/make/`:
- **Windows**: `out/make/squirrel.windows/x64/Nextron-Setup.exe`
- **macOS**: `out/make/zip/darwin/x64/...` and `.dmg`
- **Linux**: `out/make/deb/x64/...`

---

## 📜 All Available Commands

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts Next.js and launches the Electron desktop app with live HMR |
| `npm run dev:web` | Runs the Next.js web application only (`http://localhost:3000`) |
| `npm run build` | Builds the Next.js production standalone bundle |
| `npm run package` | Builds an unpacked executable in `out/` for quick testing |
| `npm run make` | Builds complete platform installers (`.exe`, `.dmg`, `.deb`) |
| `npm run typecheck` | Checks TypeScript for type errors across all files |
| `npm run lint` | Runs ESLint analysis |
| `npm run lint:fix` | Automatically fixes autofixable ESLint errors |
| `npm run clean` | Cleans `.next` and `out/` build directories |

---

## 📁 Project Structure

```
nextron/
├── app/                        # Next.js App Router (UI & Server)
│   ├── actions/                # Server Actions ("use server" functions)
│   │   ├── db-action.ts        # Database Server Actions
│   │   └── server-action.ts    # Example Server RPC verification
│   ├── api/                    # Route Handlers (REST & SSE endpoints)
│   │   ├── db/route.ts         # REST API for database queries, pagination, export
│   │   ├── db/stream/route.ts  # Real-time SSE stream for web preview
│   │   └── system/route.ts     # System metrics demo route (/api/system)
│   ├── database/page.tsx       # Dedicated /database route
│   ├── globals.css             # Drag regions (.app-drag), sleek scrollbars, theme tokens
│   ├── layout.tsx              # Root layout with ThemeProvider and DesktopLayoutShell
│   └── page.tsx                # Master Dashboard (Overview, Studio, Native OS, RPC)
│
├── components/                 # Reusable React components
│   ├── desktop-titlebar.tsx    # Native draggable title bar with window controls
│   ├── desktop-layout-shell.tsx# Global layout shell integrating title bar & palette
│   ├── command-palette.tsx     # Raycast-style Cmd+K / Ctrl+K command launcher
│   ├── database-studio.tsx     # Full desktop database studio with table/JSON & export
│   ├── database-panel.tsx      # Embedded database quick demo panel
│   ├── native-playground.tsx   # Interactive testing bench for native OS capabilities
│   ├── theme-provider.tsx      # Dark/light theme context
│   └── ui/                     # Accessible UI components (button, card, toast)
│
├── lib/
│   ├── db/                     # Real-Time JSON Database SDK
│   │   ├── engine.ts           # Core DB engine with query operators & retry locking
│   │   ├── client.ts           # Client SDK: useDatabase(), useDocument(), useKeyValue()
│   │   ├── types.ts            # Shared TypeScript interfaces & query filter types
│   │   └── index.ts            # Singleton export
│   └── utils.ts                # Utilities & useIsClient hook
│
├── electron/                   # Electron Process Files
│   ├── main.cjs                # Main process: window controls, IPC handlers, native theme
│   ├── preload.cjs             # Preload bridge exposing window.desktop securely
│   ├── database.cjs            # CJS mirror of DB engine for main process
│   └── types.d.ts              # Complete TypeScript definitions for window.desktop
│
├── scripts/
│   └── prepare-desktop.mjs    # Postbuild: copies static assets into standalone/
│
├── data/                       # Auto-created at runtime (gitignored)
│   ├── db.json                 # Real-time database file
│   └── backups/                # Automated database backups
│
├── forge.config.cjs            # Electron Forge packaging & installer configuration
├── next.config.ts              # Next.js config (standalone, dev origins, watch options)
├── package.json                # Scripts, dependencies, and metadata
└── tsconfig.json               # TypeScript configuration
```

---

## 📄 License

MIT License. Free to use for personal, open-source, and commercial desktop applications.
