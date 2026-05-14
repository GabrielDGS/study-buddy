"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import ThemeToggleInline from "./ThemeToggle";

// `beforeinstallprompt` is non-standard; declare its prompt() shape.
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function UserMenu({
  name,
  email,
}: {
  name: string;
  email: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(
    null
  );
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Capture the install prompt (Chrome / Edge / Android) so we can show our own UI.
  useEffect(() => {
    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setInstallEvent(e as InstallPromptEvent);
    }
    function onAppInstalled() {
      setInstallEvent(null);
      setInstalled(true);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onAppInstalled);

    // If already running standalone, treat as installed
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches
    ) {
      setInstalled(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function install() {
    if (!installEvent) return;
    setOpen(false);
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") {
      setInstalled(true);
    }
    setInstallEvent(null);
  }

  const initial = name.charAt(0).toUpperCase();
  // iOS Safari doesn't fire beforeinstallprompt — we still show a hint.
  const iosLikely =
    typeof window !== "undefined" &&
    /iphone|ipad|ipod/i.test(window.navigator.userAgent) &&
    !installed;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="h-9 w-9 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white text-sm font-semibold flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-transform"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {initial}
      </button>
      {open && (
        <div
          className="absolute right-0 mt-2 w-64 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl py-1 z-50"
          role="menu"
        >
          <div className="px-3 py-2.5 border-b border-slate-100 dark:border-slate-700">
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
              {name}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {email}
            </div>
          </div>

          <ThemeToggleInline />

          {installEvent && (
            <button
              onClick={install}
              className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-brand-50 dark:hover:bg-brand-950/40 flex items-center gap-2"
              role="menuitem"
            >
              <span aria-hidden>📲</span> Install app
            </button>
          )}

          {!installEvent && iosLikely && (
            <div className="px-3 py-2 text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700">
              <div className="font-medium text-slate-800 dark:text-slate-200 mb-0.5">
                📲 Install on iOS
              </div>
              Tap the share button{" "}
              <span aria-hidden>⬆️</span>, then{" "}
              <span className="font-medium">Add to Home Screen</span>.
            </div>
          )}

          {installed && (
            <div className="px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-t border-slate-100 dark:border-slate-700">
              ✓ App installed
            </div>
          )}

          <button
            onClick={logout}
            className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 border-t border-slate-100 dark:border-slate-700"
            role="menuitem"
          >
            <span aria-hidden>🚪</span> Log out
          </button>
        </div>
      )}
    </div>
  );
}
