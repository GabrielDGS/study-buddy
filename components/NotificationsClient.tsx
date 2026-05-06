"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type AppNotification = {
  id: string;
  title: string;
  body: string;
  url: string;
  priority: "high" | "normal";
};

const SEEN_KEY = "sb_notif_seen_v1";
const PERMISSION_DISMISSED_KEY = "sb_notif_perm_dismissed_v1";
const POLL_MS = 5 * 60 * 1000; // 5 min while app is open

function loadSeen(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(parsed);
  } catch {
    return new Set();
  }
}

function saveSeen(seen: Set<string>) {
  try {
    // Trim old entries (keep last 200)
    const arr = Array.from(seen);
    const trimmed = arr.slice(-200);
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(trimmed));
  } catch {
    /* ignore */
  }
}

export default function NotificationsClient() {
  const router = useRouter();
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [showBanner, setShowBanner] = useState(false);
  const [pendingInApp, setPendingInApp] = useState<AppNotification[]>([]);

  // Detect support + current state
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
    const dismissed =
      window.localStorage.getItem(PERMISSION_DISMISSED_KEY) === "1";
    if (Notification.permission === "default" && !dismissed) {
      setShowBanner(true);
    }
  }, []);

  // Poll for notifications
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function check() {
      try {
        const res = await fetch("/api/notifications/check");
        if (!res.ok) return;
        const data = (await res.json()) as { notifications: AppNotification[] };
        if (cancelled) return;

        const seen = loadSeen();
        const fresh = data.notifications.filter((n) => !seen.has(n.id));
        if (fresh.length === 0) return;

        // Use OS notifications if granted, otherwise show in-app toast
        if (
          typeof Notification !== "undefined" &&
          Notification.permission === "granted"
        ) {
          for (const n of fresh) {
            try {
              const native = new Notification(n.title, {
                body: n.body,
                icon: "/icon",
                badge: "/icon",
                tag: n.id,
              });
              native.onclick = () => {
                window.focus();
                router.push(n.url);
              };
            } catch {
              // Some browsers (esp. on mobile) need SW.showNotification — fall back
              if (
                "serviceWorker" in navigator &&
                navigator.serviceWorker.controller
              ) {
                const reg = await navigator.serviceWorker.getRegistration();
                reg?.showNotification(n.title, {
                  body: n.body,
                  icon: "/icon",
                  badge: "/icon",
                  tag: n.id,
                  data: { url: n.url },
                });
              }
            }
            seen.add(n.id);
          }
          saveSeen(seen);
        } else {
          // No OS perm — show as in-app toast(s) we render below
          setPendingInApp((prev) => {
            const existingIds = new Set(prev.map((p) => p.id));
            const merged = [
              ...prev,
              ...fresh.filter((n) => !existingIds.has(n.id)),
            ];
            return merged.slice(-3); // never more than 3 stacked
          });
          for (const n of fresh) seen.add(n.id);
          saveSeen(seen);
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) {
          timer = setTimeout(check, POLL_MS);
        }
      }
    }

    check();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [router]);

  async function requestPermission() {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setPermission(result);
    setShowBanner(false);
    window.localStorage.setItem(PERMISSION_DISMISSED_KEY, "1");
  }

  function dismissBanner() {
    setShowBanner(false);
    window.localStorage.setItem(PERMISSION_DISMISSED_KEY, "1");
  }

  function dismissToast(id: string) {
    setPendingInApp((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <>
      {/* Permission request banner */}
      {showBanner && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-[calc(100%-2rem)] animate-fade-in-up">
          <div className="card p-4 shadow-xl border-brand-200 bg-gradient-to-br from-white to-brand-50">
            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0" aria-hidden>🔔</span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-900 text-sm">
                  Get reminders for your tests & assignments
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Allow notifications so we can remind you the day before
                  each due item and warn you if your streak is about to break.
                </p>
                <div className="flex gap-2 mt-3">
                  <button
                    className="btn-primary text-xs px-3 py-1.5"
                    onClick={requestPermission}
                  >
                    Turn on
                  </button>
                  <button
                    className="btn-ghost text-xs px-3 py-1.5"
                    onClick={dismissBanner}
                  >
                    Not now
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* In-app fallback toasts */}
      {pendingInApp.length > 0 && (
        <div className="fixed bottom-4 right-4 z-40 space-y-2 max-w-sm">
          {pendingInApp.map((n) => (
            <div
              key={n.id}
              className="card p-3 shadow-xl border-brand-200 bg-white animate-fade-in-up cursor-pointer hover:scale-[1.02] transition-transform"
              onClick={() => {
                router.push(n.url);
                dismissToast(n.id);
              }}
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-900 text-sm">
                    {n.title}
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">{n.body}</div>
                </div>
                <button
                  className="text-slate-400 hover:text-slate-700 text-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    dismissToast(n.id);
                  }}
                  aria-label="Dismiss"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Permission status hint when granted but might be silently muted */}
      {permission === "denied" && showBanner && null}
    </>
  );
}
