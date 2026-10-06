# Nextron 🚀

> **Turn your Next.js skills into production-grade desktop applications.**  
> A state-of-the-art desktop framework combining **Next.js 16 (App Router + React 19)**, **Electron 37**, **shadcn/ui**, **Tailwind CSS 4**, and a **zero-promise, isomorphic real-time database**.

If you know how to build modern web apps with Next.js and React, you can build native desktop software with Nextron today. Write standard Next.js code—Nextron packages it into a native Windows (`.exe`), macOS (`.dmg`), or Linux (`.deb`) installer with a single command.

Unlike conventional Electron starters that require static HTML exports (`output: 'export'`), Nextron runs a **self-contained standalone Next.js server** inside the packaged application. That means **Route Handlers (`/api/...`)**, **Server Actions (`"use server"`)**, **Node.js APIs**, and the **unified real-time database** all work both in local development **and** in your distributed desktop installer.

---

## 🌟 What Makes This Kit Unbeatable?

### 1. 🗄️ Zero-Promise Isomorphic Database (`@/lib/db`)
- **No Client vs Server Confusion**: Import `import { db, useCollection, useValue } from "@/lib/db"` anywhere—in Client Components (`"use client"`), Server Components (RSC), Server Actions (`"use server"`), API Routes, or the Electron Main process.
- **Synchronous Zero-Promise Reads**: `db.collection('todos').find()` returns `Todo[]` **instantly** without `await`, without `useEffect` loading flicker, and without hydration mismatches.
- **Instant Optimistic Writes**: `db.collection('todos').insert({ title: 'Task' })` updates memory and UI on the exact same frame, while persisting in the background! (Also dual-compatible so `await` works if you prefer!).
- **MongoDB-Style Queries**: `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`, `$contains`, `$startsWith`, `$regex`, and full-text `_search`.
- **Built-in Aggregations & Pagination**: `count()`, `sum()`, `avg()`, `min()`, `max()`, and `findPaginated()`.

### 2. 🎛️ Single JSON Configuration (`desktop.config.json`)
- Never waste time updating multiple config files again!
- Edit **`desktop.config.json`** to customize:
  - App Name, Slug, Description, Version, and Author.
  - Window dimensions, minimum width/height, title bar style, and background color.
  - Installer names, icons, copyright, and platform build settings.
- Automatically synchronizes `package.json`, `forge.config.cjs`, `electron/main.ts`, `components/desktop-titlebar.tsx`, and Next.js page metadata!

### 3. 🛠️ Project Initializer App (No Git Clone Required!)
- You don't even need to `git clone` this kit to start a new project!
- Launch the visual Electron **Project Initializer GUI**:
  ```bash
  npm run init:app
  # or: npm run creator
  ```
- Or run the interactive terminal CLI:
  ```bash
  npm run init:cli
  ```
- Browse to your desired directory, choose your app name and theme, click **"Initialize"**, and your new desktop app is scaffolded in seconds.

### 4. 🪟 Production-Ready Desktop UI & Sidebar
- **Hydration-Safe Sidebar**: Includes shadcn/ui Sidebar primitives in `components/ui/sidebar.tsx` and `components/app-sidebar.tsx`. Eliminates the common `useMemo` / `Math.random` skeleton hydration mismatch bug with deterministic widths.
- **Custom Frameless Title Bar**: Native window drag regions (`app-drag` / `app-no-drag`), minimize, maximize/restore, close buttons, and macOS traffic lights support.
- **Raycast-Style Command Palette (`Cmd+K` / `Ctrl+K`)**: Search commands, collections, and trigger OS actions.

---

## 🏁 Quick Start

### Option A: Initialize a New Project (Recommended)
You can use the built-in visual Initializer app to scaffold a brand new project anywhere on your computer:
```bash
npm run init:app
```
*Or use the terminal prompt:*
```bash
npm run init:cli
```

### Option B: Develop in This Workspace
```bash
# 1. Install dependencies
npm install

# 2. Start Next.js + Electron with instant Hot Reload
npm run dev
```

> 💡 **Prefer testing in a browser?** Run `npm run dev:web` to open `http://localhost:3000`. Native OS features will gracefully adapt, and the real-time database and server actions remain fully functional.

---

## 🗄️ Database Quick Reference: How to Use

The database is 100% isomorphic and lives in `data/db.json`.

### 1. In React Client Components (`useCollection`)
Zero promises, zero suspense hassle, zero loading flash:
```tsx
"use client";

import { useCollection } from "@/lib/db";

interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

export function TodoList() {
  const { items, insert, update, remove, count } = useCollection<Todo>("todos");

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2>Tasks ({count})</h2>
        <button onClick={() => insert({ title: "New Task", completed: false })}>
          Add Task
        </button>
      </div>

      <ul>
        {items.map((todo) => (
          <li key={todo.id} className="flex gap-2 items-center">
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={(e) => update(todo.id, { completed: e.target.checked })}
            />
            <span>{todo.title}</span>
            <button onClick={() => remove(todo.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### 2. In Server Components, Server Actions, or Route Handlers (`db`)
Synchronous, instant, zero-promise queries:
```tsx
import { db } from "@/lib/db";

// Server Component (RSC) or Server Action
export async function getActiveTodos() {
  // Synchronous read - no await needed!
  const todos = db.collection("todos").find({ completed: false });
  return todos;
}

// Server Action
export async function addTodoAction(title: string) {
  // Instant write - returns the created document immediately!
  const newTodo = db.collection("todos").insert({
    title,
    completed: false,
    source: "Server Action",
  });
  return newTodo;
}
```

### 3. Advanced Querying Examples
```ts
import { db } from "@/lib/db";

const collection = db.collection("products");

// 1. Filtering with operators
const inStock = collection.find({
  price: { $gte: 20, $lte: 100 },
  category: { $in: ["electronics", "software"] }
});

// 2. Full-text search
const searchResults = collection.find({ _search: "camera" });

// 3. Sorting & Pagination
const pageOne = collection.findPaginated(
  { inStock: true },
  { sort: "price", order: "asc", page: 1, limit: 10 }
);

// 4. Aggregations
const totalCount = collection.count();
const avgPrice = collection.avg("price");
const minPrice = collection.min("price");
const maxPrice = collection.max("price");

// 5. Key-Value Store
db.set("settings.theme", "dark");
const currentTheme = db.get("settings.theme", "dark");
```

---

## ⚙️ Customizing Your Desktop App (`desktop.config.json`)

To change your app name, version, window size, or build configuration, **edit `desktop.config.json`**:

```json
{
  "app": {
    "name": "My Desktop App",
    "slug": "my-desktop-app",
    "version": "1.0.0",
    "description": "My stunning cross-platform app",
    "author": {
      "name": "Jane Doe",
      "email": "jane@example.com"
    },
    "bundleId": "com.janedoe.mydesktopapp"
  },
  "window": {
    "title": "My Desktop App",
    "width": 1280,
    "height": 840,
    "minWidth": 920,
    "minHeight": 620,
    "backgroundColor": "#090d16",
    "titleBarStyle": "hidden",
    "frame": false
  },
  "database": {
    "filename": "db.json",
    "autoBackup": true
  },
  "build": {
    "icon": "./public/icon",
    "copyright": "Copyright © 2026 Jane Doe"
  }
}
```

When you run `npm run dev` or `npm run build`, `package.json` and all Electron Forge configurations update automatically.

---

## 🖥️ Native OS Capabilities (`window.desktop`)

You can call native desktop features from any client component via `window.desktop`:

```tsx
// 1. Native File Dialog
const res = await window.desktop?.dialog.showOpenDialog({
  title: "Select an Image",
  filters: [{ name: "Images", extensions: ["png", "jpg"] }],
});

// 2. Native OS Notifications
window.desktop?.notification.show("Download Complete", "Your export is ready!");

// 3. System Clipboard
await window.desktop?.clipboard.writeText("Copied from Nextron!");
const text = await window.desktop?.clipboard.readText();

// 4. Reveal in File Explorer / Finder
await window.desktop?.shell.showItemInFolder("C:\\path\\to\\file.txt");

// 5. Open External Links in Default Browser
await window.desktop?.openExternal("https://github.com");

// 6. Window Controls
window.desktop?.window.minimize();
window.desktop?.window.toggleMaximize();
window.desktop?.window.close();
```

---

## 📦 Building & Distributing Installers

To package your desktop app into native production installers:

```bash
# Generate production installer for your current OS:
npm run make
```

- **Windows**: Produces a standalone Squirrel installer (`.exe`) in `out/make/squirrel.windows/x64/`.
- **macOS**: Produces a `.dmg` and `.zip` in `out/make/`.
- **Linux**: Produces a Debian package (`.deb`) in `out/make/deb/x64/`.

---

## 📜 All Available Scripts

| Script | Purpose |
| :--- | :--- |
| `npm run dev` | Starts Next.js and Electron with live watch and hot reload |
| `npm run dev:web` | Starts Next.js development server in web browser mode |
| `npm run init:app` | Launches the visual Electron Project Initializer GUI |
| `npm run init:cli` | Launches the interactive terminal project initializer |
| `npm run sync:config` | Synchronizes `desktop.config.json` into `package.json` |
| `npm run build` | Compiles Electron TypeScript and builds standalone Next.js server |
| `npm run make` | Packages the application into native OS installers (`.exe`, `.dmg`, `.deb`) |
| `npm run typecheck` | Validates TypeScript across Next.js and Electron |
| `npm run lint` | Runs ESLint with zero-error validation |
| `npm run clean` | Cleans `.next` and `out` build cache |

---

## 🛡️ License

MIT License. Crafted for high-velocity software engineering.
