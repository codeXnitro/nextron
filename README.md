# Nextron 🚀

> **Turn your Next.js skills into real desktop applications.**  
> A beginner-friendly desktop starter kit powered by **Next.js 16 (App Router)**, **Electron**, **shadcn/ui**, and a built-in **real-time JSON database**.

If you know how to build a website with Next.js and React, you already know how to build a desktop app with Nextron. Write normal Next.js code — Nextron packages it into a native Windows, macOS, or Linux application with a single command.

Unlike most Electron starters that force static exports (`output: 'export'`), Nextron runs a self-contained Next.js server inside the packaged app. That means **Route Handlers (`/api/...`)**, **Server Actions (`"use server"`)**, **Node.js APIs**, and the **built-in real-time database** all work both during development **and** in your distributed desktop installer.

---

## ✨ Highlights

- ⚡ **Next.js 16 (App Router + Webpack HMR)**: Build your UI using modern React patterns. Child components and new pages update instantly in the desktop window — no restart needed.
- 🖥️ **Full Server-Side Support**: API routes and Server Actions work after packaging.
- 🗄️ **Real-Time JSON Database**: A zero-config, zero-dependency database built right in. Access it from React components, Server Actions, API routes, and Electron's main process simultaneously.
- 🎨 **shadcn/ui + Tailwind CSS 4**: Clean, accessible UI components you own in your codebase.
- 🔒 **Secure by Default**: Node integration is disabled in the renderer; a safe IPC bridge is provided via `window.desktop`.
- 📦 **Optimized Packaging**: Tiny ASAR footprint and fast installer creation with Electron Forge.

---

## 🏁 Quick Start (5 Minutes)

### Prerequisites

- [Node.js](https://nodejs.org/) version `20.9` or higher (comes with `npm`).

### 1. Clone and Install

```bash
# 1. Clone the starter
git clone https://github.com/codeXnitro/nextron.git my-desktop-app

# 2. Open the project folder
cd my-desktop-app

# 3. Install all dependencies
npm install
```

### 2. Start Developing

```bash
npm run dev
```

This single command starts the Next.js local server and automatically launches your app in an Electron desktop window with **instant live hot-reloading** — edit any file and see changes immediately.

> 💡 **Prefer testing in a browser?** Run `npm run dev:web` instead and visit `http://localhost:3000`. You won't have the native desktop features, but everything else (including the database) will work.

---

## 🧭 Project Map — Where Do I Edit?

You don't need to know Electron internals to start building. Here is where everything lives:

| What do you want to do? | Edit this file |
| :--- | :--- |
| **Change the main screen / UI** | [`app/page.tsx`](app/page.tsx) |
| **Add a new page** (e.g. `/settings`) | Create `app/settings/page.tsx` |
| **Add a reusable UI component** | Create `components/my-component.tsx` |
| **Customize colors, fonts, or styling** | [`app/globals.css`](app/globals.css) |
| **Add a backend API route** | Create `app/api/my-route/route.ts` |
| **Add a Server Action** | Create `app/actions/my-action.ts` |
| **Use the database in React** | `import { useDatabase } from "@/lib/db/client"` |
| **Use the database server-side** | `import { db } from "@/lib/db"` |
| **Expose a native desktop feature** | [`electron/preload.cjs`](electron/preload.cjs) + [`electron/main.cjs`](electron/main.cjs) |
| **Change app name, version, author** | [`package.json`](package.json) |
| **Configure installer & icons** | [`forge.config.cjs`](forge.config.cjs) |

---

## 🛠️ How to Build Your App

### 1. Building UI Pages (Next.js App Router)

Nextron uses the standard Next.js App Router. Add pages just like any web project:

```tsx
// app/settings/page.tsx
export default function SettingsPage() {
  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold">Settings</h1>
      <p className="text-muted-foreground mt-2">Your settings go here.</p>
    </main>
  );
}
```

That's it — navigate to `/settings` and it works. You can add new shadcn/ui components anytime:

```bash
npx shadcn@latest add dialog input dropdown-menu
```

---

### 2. The Real-Time JSON Database 🗄️

Nextron includes a built-in, zero-dependency, real-time JSON database stored as a plain `db.json` file in your app directory. No setup required — it starts automatically.

**The database is accessible from everywhere:**

| Location | How to use |
| :--- | :--- |
| React component (client-side) | `useDatabase()` hook or `dbClient` from `@/lib/db/client` |
| Server Action (`"use server"`) | `import { db } from "@/lib/db"` |
| API Route Handler | `import { db } from "@/lib/db"` |
| Electron Main Process | `db` returned by `initDatabase()` in `electron/database.cjs` |

#### Option A: React Hook (recommended for UI components)

The `useDatabase()` hook fetches data and keeps it in sync in real time across all open windows and access layers.

```tsx
"use client";

import { useDatabase } from "@/lib/db/client";

type Note = { id: string; text: string; createdAt: string; updatedAt: string };

export default function NotesPage() {
  const { data: notes, loading, insert, remove, update } = useDatabase<Note>("notes");

  const addNote = () => insert({ text: "My new note" });

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <button onClick={addNote}>Add Note</button>
      {notes.map((note) => (
        <div key={note.id}>
          <p>{note.text}</p>
          <button onClick={() => remove(note.id)}>Delete</button>
        </div>
      ))}
    </div>
  );
}
```

**The hook returns:**

| Property | Type | Description |
| :--- | :--- | :--- |
| `data` | `T[]` | The live array of documents in the collection |
| `loading` | `boolean` | `true` while the first fetch is in progress |
| `error` | `Error \| null` | Any error that occurred |
| `insert(doc)` | `async (doc) => T` | Add a new document (ID auto-generated) |
| `update(id, changes)` | `async (id, changes) => T` | Update fields on a document by ID |
| `remove(id)` | `async (id) => boolean` | Delete a document by ID |
| `refresh()` | `async () => void` | Manually re-fetch the collection |

#### Option B: Server Action (for mutations from server)

```ts
// app/actions/notes-action.ts
"use server";

import { db } from "@/lib/db";

export async function saveNoteAction(text: string) {
  const note = await db.collection("notes").insert({ text });
  return { success: true, note };
}

export async function deleteNoteAction(id: string) {
  return db.collection("notes").delete(id);
}
```

Call it from your React component like a normal async function — Next.js handles the RPC automatically.

#### Option C: Key-Value Storage (for simple settings)

For storing a single value (like a setting or preference) instead of a collection:

```tsx
"use client";
import { useKeyValue } from "@/lib/db/client";

export function ThemeSelector() {
  const [colorTheme, setColorTheme, loading] = useKeyValue<string>("userColorTheme", "blue");

  return (
    <select value={colorTheme} onChange={(e) => setColorTheme(e.target.value)}>
      <option value="blue">Blue</option>
      <option value="purple">Purple</option>
    </select>
  );
}
```

#### How the database works

- **Location (dev)**: `data/db.json` in your project root.
- **Location (packaged app)**: `resources/data/db.json` next to the installed executable (writable by the user).
- **Format**: Plain human-readable JSON — open it in any text editor to inspect or edit data directly.
- **Real-time sync**: All layers (Electron main, Next.js server, React client) share the same file. Changes in one layer are detected by file-watching and broadcast to all others in milliseconds.
- **Safe writes**: All writes use an atomic temp-file-then-rename strategy to prevent corruption.

---

### 3. Server-Side Code (Route Handlers & Server Actions)

Because Nextron runs a standalone Node.js server in production, you can safely run server code:

#### API Route Handler

Create a file at `app/api/hello/route.ts`:

```ts
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ message: "Hello from the local Next.js server!" });
}
```

Fetch it from any React component:

```tsx
const res = await fetch("/api/hello");
const data = await res.json();
```

#### Server Action

```ts
// app/actions/my-action.ts
"use server";

export async function processData(input: string) {
  // This runs on the local Node.js server — even in the packaged app!
  return { result: input.toUpperCase(), at: new Date().toISOString() };
}
```

```tsx
// Call it from any component
import { processData } from "@/app/actions/my-action";

const result = await processData("hello");
```

---

### 4. Calling Native Desktop Features (Electron Bridge)

Your React UI runs in a secure sandbox. To use native OS features (file dialogs, notifications, system info), use the `window.desktop` bridge:

```tsx
// Open a URL in the user's default browser
<button onClick={() => window.desktop?.openExternal("https://nextjs.org")}>
  Open Docs
</button>
```

#### How to add your own native feature (step-by-step)

**Step 1** — Handle it in [`electron/main.cjs`](electron/main.cjs):
```javascript
ipcMain.handle("desktop:show-notification", (_event, title, body) => {
  new Notification({ title, body }).show();
});
```

**Step 2** — Expose it safely in [`electron/preload.cjs`](electron/preload.cjs):
```javascript
contextBridge.exposeInMainWorld("desktop", {
  // ... existing functions ...
  showNotification: (title, body) =>
    ipcRenderer.invoke("desktop:show-notification", title, body),
});
```

**Step 3** — Add the TypeScript type in [`electron/types.d.ts`](electron/types.d.ts):
```typescript
declare global {
  interface Window {
    desktop?: {
      // ... existing types ...
      showNotification(title: string, body: string): Promise<void>;
    };
  }
}
```

**Step 4** — Call it from any React component:
```tsx
window.desktop?.showNotification("Saved!", "Your file has been saved.");
```

---

## 📦 Packaging — Creating an Installer

When your application is ready to ship:

### Step 1: Update your app metadata in `package.json`

```json
{
  "name": "my-cool-app",
  "version": "1.0.0",
  "description": "My first desktop application",
  "author": "Your Name <you@example.com>"
}
```

### Step 2: Build and create an installer

```bash
npm run make
```

This automatically:
1. Builds the Next.js production bundle
2. Bundles the standalone server and all assets
3. Creates a platform-native installer

### Step 3: Find your installer

Your distributable files appear in the `out/make/` directory:

- **Windows**: `out/make/squirrel.windows/x64/my-cool-app-1.0.0 Setup.exe`
- **macOS**: `out/make/zip/darwin/x64/...`
- **Linux**: `out/make/deb/x64/...`

Send the `Setup.exe` to anyone — they install and run your app without needing Node.js.

> 💡 **Note**: The database file (`db.json`) is created fresh the first time users run your packaged app. It is stored in a writable location next to the executable, not inside the installer itself.

---

## 📜 All Available Commands

| Command | What it does |
| :--- | :--- |
| `npm run dev` | Starts Next.js + Electron together with live hot-reloading |
| `npm run dev:web` | Starts only the Next.js server in your browser (`http://localhost:3000`) |
| `npm run build` | Builds the Next.js production bundle (runs automatically before `make`) |
| `npm run package` | Builds and creates an unpacked portable executable in `out/` |
| `npm run make` | Builds and generates complete platform installers (`.exe`, `.dmg`, `.deb`) |
| `npm run typecheck` | Checks all TypeScript files for type errors |
| `npm run lint` | Checks code style and catches potential bugs with ESLint |

---

## 📁 Project Structure

```
nextron/
├── app/                        # Next.js App Router (your UI lives here)
│   ├── actions/                # Server Actions ("use server" functions)
│   │   ├── server-action.ts    # Example Server Action
│   │   └── db-action.ts        # Database Server Actions (create/toggle/delete)
│   ├── api/                    # Route Handlers (REST API endpoints)
│   │   ├── db/route.ts         # Database REST API (/api/db)
│   │   ├── db/stream/route.ts  # Real-time SSE stream for web clients
│   │   └── system/route.ts     # System info demo route (/api/system)
│   ├── database/page.tsx       # Dedicated /database page
│   ├── globals.css             # Global CSS + Tailwind theme tokens
│   ├── layout.tsx              # Root layout with ThemeProvider
│   └── page.tsx                # Home page (/)
│
├── components/                 # Reusable React components
│   ├── database-panel.tsx      # Interactive real-time DB demo panel
│   ├── theme-provider.tsx      # Dark/light theme context
│   └── ui/                     # shadcn/ui components (button, card, etc.)
│
├── lib/
│   └── db/                     # Real-Time JSON Database SDK
│       ├── engine.ts           # Core DB engine (TypeScript, for server-side)
│       ├── client.ts           # Client SDK: useDatabase(), useKeyValue() hooks
│       ├── types.ts            # Shared TypeScript interfaces
│       └── index.ts            # Exports singleton `db` instance
│
├── electron/                   # Electron-specific files (touch only for native features)
│   ├── main.cjs                # Main process: window, IPC handlers, DB init
│   ├── preload.cjs             # Preload script: exposes window.desktop bridge
│   ├── database.cjs            # CJS mirror of the DB engine for the main process
│   └── types.d.ts              # TypeScript types for window.desktop
│
├── scripts/
│   └── prepare-desktop.mjs    # Postbuild: copies static assets into standalone/
│
├── data/                       # Auto-created at runtime (gitignored)
│   └── db.json                 # Your app's real-time database file
│
├── forge.config.cjs            # Electron Forge packaging & installer config
├── next.config.ts              # Next.js config (HMR origins, webpack watch, standalone)
├── package.json                # Scripts, dependencies, app metadata
└── tsconfig.json               # TypeScript config
```

---

## ❓ Frequently Asked Questions

<details>
<summary><strong>Do I need to learn Electron to build my app?</strong></summary>

No! For 95% of your work, you build normal Next.js pages and React components inside `app/`. You only need to touch `electron/` when you want native OS powers like system tray icons, native menus, or file system dialogs.
</details>

<details>
<summary><strong>Where is the database file stored?</strong></summary>

- **During development**: `data/db.json` in your project root. You can open it in any text editor to inspect or manually edit your data.
- **In the packaged/installed app**: In a writable `data/` folder next to the application's resources directory (e.g., `C:\Program Files\MyApp\resources\data\db.json` on Windows). If that path isn't writable (e.g., due to UAC), it automatically falls back to the user's app data directory.

The `data/` folder is listed in `.gitignore` and is never committed to version control.
</details>

<details>
<summary><strong>How do I see what's in the database right now?</strong></summary>

Three ways:
1. Open `data/db.json` in any text editor — it's plain, human-readable JSON.
2. In the running app, click **"Inspect db.json"** in the Database Panel on the home page to see a live view.
3. Fetch `GET /api/db?stats=true` or `GET /api/db?collection=todos` in your browser's DevTools network tab.
</details>

<details>
<summary><strong>Is the database good for production apps?</strong></summary>

The built-in JSON database is a great fit for:
- Personal desktop tools and productivity apps
- Apps with hundreds to low thousands of documents per collection
- Any data that can comfortably fit in a single JSON file

For apps with heavy write throughput, large datasets, or complex relational queries, consider upgrading to SQLite (e.g., `better-sqlite3`) or Prisma — both work perfectly in Nextron since the standalone Node.js server is fully functional.
</details>

<details>
<summary><strong>Why not use Next.js static export (<code>output: 'export'</code>)?</strong></summary>

Static export converts your app to plain HTML/CSS/JS files, which completely breaks Server Actions, Route Handlers (`/api/...`), and the real-time database. Nextron uses `output: 'standalone'` mode, giving you the full power of Next.js server features on the desktop — including after packaging.
</details>

<details>
<summary><strong>My changes aren't showing up in the Electron window — what do I do?</strong></summary>

This is already fixed in this starter! The dev script uses `--webpack` for reliable HMR on Windows, and Electron is configured to skip HTTP caching in development mode.

If you're still seeing stale content:
1. Make sure you're running `npm run dev` (not just opening Electron manually).
2. Try pressing `Ctrl+R` (or `Cmd+R` on macOS) in the Electron window to force a full reload.
3. Check the terminal for any Next.js compilation errors.
</details>

<details>
<summary><strong>How do I add an app icon?</strong></summary>

1. Create your icon: `.ico` for Windows, `.icns` for macOS, `.png` for Linux.
2. Place it in your project (e.g., `public/icon.ico`).
3. Add the `icon` path to `packagerConfig` in [`forge.config.cjs`](forge.config.cjs):
   ```javascript
   packagerConfig: {
     asar: true,
     icon: "./public/icon", // Electron Forge adds the correct extension per platform
     // ...
   }
   ```
</details>

---

## 📄 License

MIT License. Free to use for personal and commercial desktop applications.
