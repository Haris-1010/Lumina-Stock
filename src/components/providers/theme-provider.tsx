"use client";

import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useSyncExternalStore } from "react";

type AppTheme = "light" | "dark";

const STORAGE_KEY = "lumina-theme";

interface ThemeContextValue {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// iOS Safari Private Browsing / "Block All Cookies" makes `localStorage` and
// `matchMedia` *throw* on access. These helpers must never throw — a throw here
// crashes ThemeProvider, which wraps the whole app, blanking the entire page.

function safeGetStored(): AppTheme | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    return null;
  }
}

function safeSetStored(theme: AppTheme) {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* storage blocked (iOS private mode) — preference just won't persist */
  }
}

function prefersDark(): boolean {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

let currentTheme: AppTheme | null = null;

function resolveInitialTheme(): AppTheme {
  if (typeof window === "undefined") return "light";
  return currentTheme ?? safeGetStored() ?? (prefersDark() ? "dark" : "light");
}

function applyTheme(theme: AppTheme) {
  try {
    const root = document.documentElement;
    root.classList.toggle("theme-dark", theme === "dark");
    root.style.colorScheme = theme;
  } catch {
    /* ignore */
  }
}

const THEME_EVENT = "lumina-theme-change";
function subscribeTheme(callback: () => void) {
  window.addEventListener(THEME_EVENT, callback);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) {
      currentTheme = null;
      callback();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(THEME_EVENT, callback);
    window.removeEventListener("storage", onStorage);
  };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // The server snapshot also supplies the first client render, keeping icons identical.
  const theme = useSyncExternalStore(subscribeTheme, resolveInitialTheme, () => "light" as AppTheme);

  useLayoutEffect(() => {
    applyTheme(resolveInitialTheme());
  }, [theme]);

  const setTheme = useCallback((nextTheme: AppTheme) => {
    currentTheme = nextTheme;
    applyTheme(nextTheme);
    safeSetStored(nextTheme);
    window.dispatchEvent(new Event(THEME_EVENT));
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(resolveInitialTheme() === "dark" ? "light" : "dark");
  }, [setTheme]);

  const contextValue = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      toggleTheme,
    }),
    [setTheme, theme, toggleTheme]
  );

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const contextValue = useContext(ThemeContext);
  if (!contextValue) {
    throw new Error("useTheme must be used within ThemeProvider");
  }

  return contextValue;
}
