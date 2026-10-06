import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { useSyncExternalStore } from "react";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const emptySubscribe = () => () => {};

export function useIsClient(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

export function useIsMobile(breakpoint = 768): boolean {
  return useSyncExternalStore(
    (callback) => {
      if (typeof window === "undefined") return () => {};
      const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
      mql.addEventListener("change", callback);
      return () => mql.removeEventListener("change", callback);
    },
    () => (typeof window !== "undefined" ? window.innerWidth < breakpoint : false),
    () => false
  );
}
