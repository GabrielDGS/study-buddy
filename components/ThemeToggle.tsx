"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("sb_theme") as Theme | null;
    if (stored === "light" || stored === "dark" || stored === "system") {
      setTheme(stored);
      applyTheme(stored);
    } else {
      applyTheme("system");
    }
  }, []);

  // Listen for OS-level theme changes while in "system" mode
  useEffect(() => {
    if (theme !== "system" || typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  function update(next: Theme) {
    setTheme(next);
    try {
      window.localStorage.setItem("sb_theme", next);
    } catch {
      /* ignore */
    }
    applyTheme(next);
  }

  return { theme, setTheme: update };
}

export default function ThemeToggleInline() {
  const { theme, setTheme } = useTheme();
  const options: { key: Theme; icon: string; label: string }[] = [
    { key: "light", icon: "☀️", label: "Light" },
    { key: "dark", icon: "🌙", label: "Dark" },
    { key: "system", icon: "🖥️", label: "Auto" },
  ];
  return (
    <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-700">
      <div className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
        Theme
      </div>
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
        {options.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setTheme(opt.key)}
            className={`flex-1 text-xs py-1.5 px-2 rounded-md font-medium transition-all ${
              theme === opt.key
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
            aria-label={opt.label}
          >
            <span aria-hidden className="mr-1">
              {opt.icon}
            </span>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
