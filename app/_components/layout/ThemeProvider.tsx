"use client";

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from "react";
import { Moon, Sun, Monitor } from "lucide-react";

export type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "drive_theme";

interface ThemeContextValue {
  mode: ThemeMode;
  resolved: "light" | "dark";
  setMode: (mode: ThemeMode) => void;
  cycleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [system, setSystem] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    if (stored === "light" || stored === "dark" || stored === "system") {
      setModeState(stored);
    }
    setSystem(getSystemTheme());
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setSystem(getSystemTheme());
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const resolved = mode === "system" ? system : mode;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolved === "dark");
    document.documentElement.style.colorScheme = resolved;
  }, [resolved]);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    localStorage.setItem(STORAGE_KEY, m);
  }, []);

  const cycleMode = useCallback(() => {
    setModeState((m) => {
      const next: ThemeMode = m === "light" ? "dark" : m === "dark" ? "system" : "light";
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ mode, resolved, setMode, cycleMode }),
    [mode, resolved, setMode, cycleMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function ThemeToggle() {
  const { mode, cycleMode } = useTheme();
  const Icon = mode === "dark" ? Moon : mode === "light" ? Sun : Monitor;
  const label = mode === "dark" ? "Dark" : mode === "light" ? "Light" : "System";

  return (
    <button
      onClick={cycleMode}
      className="w-9 h-9 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400 transition-colors"
      title={`Theme: ${label}`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}
