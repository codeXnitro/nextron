"use client";

import { db, useCollection, useDocument, useValue, useDatabaseStats } from "./index";

export * from "./types";
export * from "./core";
export * from "./index";

export function isDesktopApp(): boolean {
  return typeof window !== "undefined" && Boolean((window as any).desktop?.db);
}

// Low-level compatibility proxy
export const dbClient = db;
