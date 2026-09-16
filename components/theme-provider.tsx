"use client";

import * as React from "react";

type Theme = "dark" | "light";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = React.createContext<ThemeContextValue | null>(null);
const storageKey = "desktop-theme";
const changeEvent = "desktop-theme-change";

const emptySubscribe = () => () => {};

function useMounted(): boolean {
  return React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

function getStoredTheme(): Theme {
  try {
    const saved = window.localStorage.getItem(storageKey);
    return saved === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function subscribeToTheme(callback: () => void) {
  const handler = () => callback();
  window.addEventListener("storage", handler);
  window.addEventListener(changeEvent, handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(changeEvent, handler);
  };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const isMounted = useMounted();
  const theme = React.useSyncExternalStore(
    subscribeToTheme,
    (): Theme => (isMounted ? getStoredTheme() : "dark"),
    (): Theme => "dark"
  );

  const setTheme = React.useCallback((nextTheme: Theme) => {
    try {
      window.localStorage.setItem(storageKey, nextTheme);
      window.dispatchEvent(new Event(changeEvent));
    } catch {
      // Ignore storage errors in restricted desktop contexts
    }
  }, []);

  React.useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    root.style.colorScheme = theme;
  }, [theme]);

  const value = React.useMemo(() => ({ theme, setTheme }), [setTheme, theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = React.useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider.");
  return context;
}
