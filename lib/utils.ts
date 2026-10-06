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
