"use client";

import { useEffect, useState } from "react";

export default function CalendarSync() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open || token) return;
    setLoading(true);
    fetch("/api/calendar/token")
      .then((r) => r.json())
      .then((d) => {
        if (d.token) setToken(d.token);
      })
      .finally(() => setLoading(false));
  }, [open, token]);

  const subscribeUrl =
    token && typeof window !== "undefined"
      ? `${window.location.origin}/api/calendar/${token}.ics`
      : "";

  function copy() {
    if (!subscribeUrl) return;
    navigator.clipboard.writeText(subscribeUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  async function rotate() {
    if (
      !confirm(
        "Generate a new calendar URL? Any device subscribed with the current URL will stop receiving updates."
      )
    )
      return;
    setLoading(true);
    const res = await fetch("/api/calendar/token", { method: "POST" });
    const d = await res.json();
    if (d.token) setToken(d.token);
    setLoading(false);
  }

  if (!open) {
    return (
      <button className="btn-secondary text-sm" onClick={() => setOpen(true)}>
        🔗 Sync to your calendar
      </button>
    );
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">
            Sync with Google / Apple / Outlook
          </h3>
          <p className="text-sm text-slate-600 mt-1">
            Subscribe to this URL in your calendar app. Events update
            automatically as you change your schedule.
          </p>
        </div>
        <button
          className="btn-ghost text-sm"
          onClick={() => setOpen(false)}
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {loading && !token ? (
        <div className="text-sm text-slate-500">Loading…</div>
      ) : (
        <>
          <div>
            <label className="label">Subscription URL</label>
            <div className="flex gap-2">
              <input
                readOnly
                value={subscribeUrl}
                className="input font-mono text-xs"
                onFocus={(e) => e.currentTarget.select()}
              />
              <button
                className="btn-primary text-sm shrink-0"
                onClick={copy}
                disabled={!subscribeUrl}
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 text-xs text-slate-600">
            <a
              href={subscribeUrl}
              download="study-buddy.ics"
              className="text-brand-600 hover:underline"
            >
              ⬇ Download as .ics
            </a>
            <button
              className="text-slate-500 hover:text-slate-700"
              onClick={rotate}
              disabled={loading}
            >
              ♻ Rotate URL
            </button>
          </div>

          <details className="text-xs text-slate-600">
            <summary className="cursor-pointer font-medium">
              How to subscribe
            </summary>
            <div className="mt-2 space-y-2 pl-2">
              <p>
                <span className="font-medium">Google Calendar (web):</span>{" "}
                Other calendars → + → From URL → paste the URL above.
              </p>
              <p>
                <span className="font-medium">Apple Calendar (Mac):</span> File
                → New Calendar Subscription → paste URL.
              </p>
              <p>
                <span className="font-medium">iPhone:</span> Settings → Calendar
                → Accounts → Add Account → Other → Add Subscribed Calendar.
              </p>
              <p>
                <span className="font-medium">Outlook:</span> Add calendar →
                Subscribe from web → paste URL.
              </p>
              <p className="text-slate-500">
                Note: in local development this URL only works from your own
                computer. For a public subscription, deploy first.
              </p>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
