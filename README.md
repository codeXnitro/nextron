# Next + Electron Desktop Kit

A small, approachable starting point for shipping a **Next.js 16** app as a desktop application with **Electron**.

## Start here

1. Install Node.js 20.9 or newer.
2. Run `npm install`.
3. Run `npm run dev`.

That one development command starts Next.js, waits for it to be ready, and opens your app in Electron.

## The map

| Want to… | Edit this |
| --- | --- |
| Build the app screen | `app/page.tsx` |
| Change colours and layout | `app/globals.css` |
| Add safe desktop features | `electron/preload.ts` |
| Add native Electron logic | `electron/main.ts` |
| Change installers, icons, signing | `forge.config.ts` |

## Build an installer

Run `npm run make`. Electron Forge will create platform installers in the `out/make` folder.

To only assemble the application without installers, run `npm run package`.

## How desktop features stay safe

Your page should never use Electron APIs directly. Instead:

1. Add a small, focused function to `electron/preload.cjs`.
2. Handle its request in `electron/main.cjs`.
3. Call it from the page through `window.desktop`.

This starter keeps `contextIsolation` enabled and Node integration disabled, so the app has a safer default boundary.

## Customizing builds

The `forge.config.ts` file is deliberately compact. It is where you can add:

- an application icon
- code-signing information
- maker-specific installer options
- publishing targets

`next.config.ts` uses Next's standalone output so the packaged application includes the server it needs to run.
