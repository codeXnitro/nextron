# Nextron

> A friendly starter kit for building, packaging, and shipping desktop apps with Next.js 16, Electron, and Electron Forge.

Build your interface with the React and Next.js workflow you already know. When it is ready, turn it into a Windows, macOS, or Linux desktop app with a single command.

## Why Nextron?

Getting a web app into a desktop window often means wiring together two different environments. Nextron keeps that setup small and understandable:

- **Next.js 16 App Router** for your application interface
- **Electron** for desktop capabilities such as windows, menus, files, and notifications
- **Electron Forge** for packaging and installer creation
- **A secure default bridge** between your UI and native code
- **One development command** to run Next.js and Electron together

## Quick start

### Requirements

- [Node.js](https://nodejs.org/) 20.9 or newer
- npm (included with Node.js)

### Create your app

```bash
git clone https://github.com/codeXnitro/nextron.git my-desktop-app
cd my-desktop-app
npm install
npm run dev
```

`npm run dev` starts the Next.js development server and opens the app in Electron. Edit `app/page.tsx` and your changes will refresh while you work.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts Next.js and Electron together for desktop development. |
| `npm run dev:web` | Starts only the Next.js web preview. |
| `npm run build` | Creates an optimized Next.js production build. |
| `npm run package` | Creates a portable packaged desktop app. |
| `npm run make` | Creates platform-specific distributables and installers in `out/make`. |
| `npm run typecheck` | Checks TypeScript types. |
| `npm run lint` | Checks code quality with ESLint. |

## Where to start editing

| You want to… | Edit this file |
| --- | --- |
| Build your app screens | `app/page.tsx` |
| Change the design | `app/globals.css` |
| Add a safe desktop API | `electron/preload.cjs` |
| Add Electron or native behaviour | `electron/main.cjs` |
| Configure installers, icons, and signing | `forge.config.cjs` |
| Rename your app, author, and package ID | `package.json` |

## Adding desktop features safely

Your React UI should not access Node.js or Electron directly. Nextron starts with a safer boundary: Node integration is disabled and context isolation is enabled.

To add a native feature:

1. Handle the operation in `electron/main.cjs`.
2. Expose one focused function in `electron/preload.cjs`.
3. Call that function from your page through `window.desktop`.

The included version label and documentation button are small examples of this pattern.

## Build and share your app

Before your first release, update these fields in `package.json`:

```json
{
  "name": "your-app-name",
  "version": "1.0.0",
  "author": "Your Name <you@example.com>"
}
```

Then create a distributable:

```bash
npm run make
```

Electron Forge places the results in `out/make`. The default Windows target creates a Squirrel installer; macOS and Debian maker settings are already included in `forge.config.cjs` for when you build on those platforms.

## Project structure

```text
app/                  Your Next.js pages and styles
electron/
  main.cjs            Main process: native desktop code and the app window
  preload.cjs         The safe API bridge exposed to the renderer
scripts/
  prepare-desktop.mjs Copies Next assets into the packaged server
forge.config.cjs      Electron Forge packaging configuration
next.config.ts        Next standalone-server configuration
```

## How production packaging works

Next.js creates a standalone server during `npm run build`. Nextron copies its required static and public assets into that server, then Electron Forge includes it as an application resource. In the packaged app, Electron starts the local Next server and loads it only after it is ready.

That means you can use normal Next.js patterns during development while still distributing a self-contained desktop application.

## Next steps

- Replace the sample screen in `app/page.tsx` with your product.
- Add a real icon and installer metadata in `forge.config.cjs`.
- Add desktop features one small, safe API at a time.
- Set up code signing before distributing broadly.

## License

MIT. See the `license` field in `package.json`.
