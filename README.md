# Nextron 🚀

> **Turn your Next.js skills into real desktop applications.**  
> A beginner-friendly desktop starter kit powered by **Next.js 16 (App Router)**, **Electron**, and **shadcn/ui**.

If you know how to build a website with Next.js and React, you already know how to build a desktop app with Nextron. You write normal Next.js code, and Nextron packages it into a native Windows, macOS, or Linux application with a single command.

Unlike most Electron starters that force static exports (`output: 'export'`), Nextron runs a self-contained Next.js server inside the packaged app. That means **Route Handlers (`/api/...`)**, **Server Actions (`"use server"`)**, and **Node.js APIs** work both during development **and** in your distributed desktop installer!

---

## ✨ Highlights

- ⚡ **Next.js 16 (Turbopack + App Router)**: Build your UI using the modern React patterns you already love.
- 🖥️ **Full Server-Side Support**: API routes (`/api/...`) and Server Actions (`"use server"`) work after packaging.
- 🎨 **shadcn/ui + Tailwind CSS**: Clean, accessible UI components you own in your codebase.
- 🔒 **Secure by Default**: Node integration disabled in the renderer; safe IPC bridge via `window.desktop`.
- 📦 **Optimized Packaging**: Tiny ASAR footprint (~10 KB) and fast installer creation with Electron Forge.
- 🔄 **Hot Reloading**: Edit your code in `app/page.tsx` and see changes immediately inside the desktop window.

---

## 🏁 Quick Start (5 Minutes)

### Prerequisites

- [Node.js](https://nodejs.org/) version `20.9` or higher.
- `npm` (comes bundled with Node.js).

### 1. Clone and Install

```bash
# 1. Clone the starter
git clone https://github.com/codeXnitro/nextron.git my-desktop-app

# 2. Open the directory
cd my-desktop-app

# 3. Install dependencies
npm install
```

### 2. Start Developing

```bash
npm run dev
```

This single command starts the Next.js local server and automatically launches your desktop app in an Electron window with live hot reloading.

> 💡 **Tip**: If you prefer testing in your regular browser (Chrome, Edge, etc.) without opening the Electron window, run:
> ```bash
> npm run dev:web
> ```
> and visit `http://localhost:3000`.

---

## 🧭 Project Map: Where Do I Edit?

You don't need to know Electron internals to start building. Here is where everything lives:

| What do you want to do? | Edit this file |
| :--- | :--- |
| **Change the UI / screens** | [`app/page.tsx`](app/page.tsx) |
| **Add a new page (e.g. `/settings`)** | Create `app/settings/page.tsx` |
| **Customize colors, fonts, or styling** | [`app/globals.css`](app/globals.css) |
| **Add a backend API route** | [`app/api/system/route.ts`](app/api/system/route.ts) (or create new ones in `app/api/...`) |
| **Add a Server Action** | [`app/actions/server-action.ts`](app/actions/server-action.ts) |
| **Expose a native desktop feature to your UI** | [`electron/preload.cjs`](electron/preload.cjs) & [`electron/main.cjs`](electron/main.cjs) |
| **Change app name, author, or version** | [`package.json`](package.json) |
| **Configure installer settings & icons** | [`forge.config.cjs`](forge.config.cjs) |

---

## 🛠️ How to Build Your App

### 1. Building UI Pages (Next.js App Router)

Nextron uses the standard Next.js App Router. Add pages and components just like any web project:

```tsx
// app/page.tsx
export default function HomePage() {
  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold">Hello Desktop!</h1>
      <p className="text-muted-foreground mt-2">Built with Next.js 16.</p>
    </main>
  );
}
```

You can add new shadcn/ui components anytime using:
```bash
npx shadcn@latest add input dialog dropdown-menu
```

---

### 2. Using Server-Side Code (Route Handlers & Server Actions)

Because Nextron runs a standalone Node.js server in production, you can run server code and access Node.js capabilities (databases, file systems, etc.) safely on the backend:

#### Option A: API Route Handlers (`/api/...`)
Create a file at `app/api/hello/route.ts`:
```ts
// app/api/hello/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ message: "Hello from local Next.js server!" });
}
```
Fetch it from your React components using `fetch('/api/hello')`.

#### Option B: Server Actions (`"use server"`)
Create a server action in `app/actions/notes.ts`:
```ts
// app/actions/notes.ts
"use server";

export async function saveNote(text: string) {
  // Runs on the local Node.js server
  console.log("Saving note on server:", text);
  return { success: true, timestamp: new Date().toISOString() };
}
```
Call it directly like a regular async function from your React buttons or forms!

---

### 3. Calling Native Desktop Features (Electron Bridge)

Your React UI runs inside a secure sandbox. To trigger native desktop operations (such as opening native file dialogs, reading window state, or launching external URLs), use the included `window.desktop` bridge:

#### Example: Opening a link in the user's default browser
```tsx
<button onClick={() => window.desktop?.openExternal("https://nextjs.org")}>
  Open Documentation
</button>
```

#### How to add your own native desktop function:
1. **Handle the event in [`electron/main.cjs`](electron/main.cjs)**:
   ```javascript
   ipcMain.handle("desktop:show-notification", (_event, title, body) => {
     new Notification({ title, body }).show();
   });
   ```
2. **Expose it safely in [`electron/preload.cjs`](electron/preload.cjs)**:
   ```javascript
   contextBridge.exposeInMainWorld("desktop", {
     // existing functions...
     showNotification: (title, body) => ipcRenderer.invoke("desktop:show-notification", title, body),
   });
   ```
3. **Add the TypeScript definition in [`electron/types.d.ts`](electron/types.d.ts)**:
   ```typescript
   interface Window {
     desktop?: {
       showNotification(title: string, body: string): Promise<void>;
     };
   }
   ```
4. **Call it anywhere in your React code**:
   ```tsx
   window.desktop?.showNotification("Hello!", "This is a native desktop notification.");
   ```

---

## 📦 Packaging & Creating an Installer

When your application is ready to share with users:

### Step 1: Update metadata in `package.json`
Set your app name, version, and author:
```json
{
  "name": "my-cool-app",
  "version": "1.0.0",
  "description": "My first desktop application",
  "author": "Your Name <you@example.com>"
}
```

### Step 2: Build the installer
Run the make command:
```bash
npm run make
```

### Step 3: Find your installer!
Electron Forge automatically compiles your Next.js application, bundles the standalone server, and places your distributables in:
- **Windows**: `out/make/squirrel.windows/x64/my-cool-app-1.0.0 Setup.exe`
- **macOS**: `out/make/zip/darwin/x64/...`
- **Linux**: `out/make/deb/x64/...`

You can send that `Setup.exe` directly to anyone to install and run your desktop app!

---

## 📜 All Available Commands

| Command | What it does |
| :--- | :--- |
| `npm run dev` | Starts Next.js and Electron together with live hot-reloading. |
| `npm run dev:web` | Starts only the Next.js preview in your browser at `http://localhost:3000`. |
| `npm run build` | Builds the Next.js production bundle and copies standalone assets. |
| `npm run package` | Builds and creates an unpacked, portable executable in `out/`. |
| `npm run make` | Builds and generates complete platform installers (`.exe`, `.dmg`, `.deb`). |
| `npm run typecheck` | Checks your TypeScript files for type errors (`tsc --noEmit`). |
| `npm run lint` | Checks code formatting and catches potential bugs with ESLint. |

---

## ❓ Frequently Asked Questions (FAQ)

<details>
<summary><strong>Do I need to learn Electron to build my app?</strong></summary>

No! For 95% of your work, you will simply build normal Next.js pages and React components inside `app/`. You only need to touch `electron/` when you want native OS powers like system tray icons, native menus, or file system dialogs.
</details>

<details>
<summary><strong>Can I use a local database like SQLite or Prisma?</strong></summary>

Yes! Because Nextron runs a standalone Node.js server in the background, you can install and use SQLite (e.g., `better-sqlite3`), Prisma, or file-based storage in your Server Actions or Route Handlers.
</details>

<details>
<summary><strong>Why not use Next.js static export (<code>output: 'export'</code>)?</strong></summary>

Static export converts your site to plain HTML/CSS/JS files, which completely breaks Next.js Server Actions, Route Handlers (`/api/...`), and dynamic server rendering. Nextron runs Next.js in `output: 'standalone'` mode, giving you the full power of Next.js server features on desktop.
</details>

<details>
<summary><strong>How do I add an app icon?</strong></summary>

Place your `.ico` (Windows) or `.icns` (macOS) file in your assets folder, and set the `icon` path in [`forge.config.cjs`](forge.config.cjs) under `packagerConfig`.
</details>

---

## 📄 License

MIT License. Free to use for personal and commercial desktop applications.
