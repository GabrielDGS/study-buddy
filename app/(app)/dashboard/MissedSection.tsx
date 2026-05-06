"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type MissedItem = {
  id: string;
  title: string;
  type: string;
  dueDate: string; // ISO
  subject: { name: string; color: string } | null;
};

const TYPE_ICON: Record<string, string> = {
  test: "📕",
  quiz: "✏️",
  assignment: "📋",
  study: "🎯",
};

function howOverdue(dueIso: string): string {
  const due = new Date(dueIso).getTime();
  const ms = Date.now() - due;
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days < 1) return "today";
  if (days === 1) return "1 day overdue";
  return `${days} days overdue`;
}

export default function MissedSection({ items }: { items: MissedItem[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const visible = items.filter((i) => !hidden.has(i.id));
  if (visible.length === 0) return null;

  async function markDone(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/schedule/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });
      if (res.ok) {
        setHidden((prev) => new Set(prev).add(id));
        router.refresh();
      }
    } finally {
      setBusyId(null);
    }
  }

  // Encode a starter prompt for the AI so the user can rebalance with one click.
  const rebalancePrompt = encodeURIComponent(
    "I missed some study sessions. Please look at my schedule and rebalance the rest of my week — move missed sessions to good days that aren't already overloaded."
  );

  return (
    <section className="card p-6 border-amber-200/80 bg-gradient-to-br from-amber-50/80 to-orange-50/60">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-xl shadow-md">
            <span aria-hidden>⏰</span>
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">
              {visible.length} missed item{visible.length === 1 ? "" : "s"}
            </h2>
            <p className="text-sm text-slate-600">
              Catch up — or have your AI buddy rebalance the rest of the week.
            </p>
          </div>
        </div>
        <Link
          href={`/chat?starter=${rebalancePrompt}`}
          className="btn-primary text-sm"
        >
          🔄 Ask AI to rebalance
        </Link>
      </div>

      <ul className="space-y-2">
        {visible.slice(0, 6).map((item) => (
          <li
            key={item.id}
            className="flex items-center gap-3 rounded-lg bg-white/80 border border-amber-100 p-3"
          >
            <span
              className="h-8 w-1 rounded-full"
              style={{ backgroundColor: item.subject?.color ?? "#94a3b8" }}
              aria-hidden
            />
            <span className="text-xl" aria-hidden>
              {TYPE_ICON[item.type] ?? "📌"}
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-slate-900 truncate">
                {item.title}
              </div>
              <div className="text-xs text-slate-500">
                {item.subject?.name ?? "No subject"} ·{" "}
                <span className="text-amber-700 font-medium">
                  {howOverdue(item.dueDate)}
                </span>
              </div>
            </div>
            <button
              className="btn-secondary text-xs"
              onClick={() => markDone(item.id)}
              disabled={busyId === item.id}
              title="I actually did this — mark done"
            >
              {busyId === item.id ? "…" : "✓ Mark done"}
            </button>
          </li>
        ))}
      </ul>
      {visible.length > 6 && (
        <p className="text-xs text-slate-500 mt-2 text-center">
          +{visible.length - 6} more —{" "}
          <Link href="/schedule" className="text-brand-600 hover:underline">
            see all in Schedule
          </Link>
          .
        </p>
      )}
    </section>
  );
}
