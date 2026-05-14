"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PomodoroTimer from "@/components/PomodoroTimer";

type Item = {
  id: string;
  title: string;
  type: string;
  typeLabel: string;
  typeIcon: string;
  typeColor: string;
  typeBg: string;
  typeText: string;
  subject: { name: string; color: string } | null;
  dueDate: string;
  estMinutes: number | null;
  notes: string | null;
  daysUntil: number;
};

function timeOfDay(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function dueText(item: Item): string {
  if (item.daysUntil < 0) {
    const d = -item.daysUntil;
    return `${d} day${d === 1 ? "" : "s"} overdue`;
  }
  if (item.daysUntil === 0) return `today at ${timeOfDay(item.dueDate)}`;
  if (item.daysUntil === 1) return "tomorrow";
  return `in ${item.daysUntil} days`;
}

export default function TodayView({
  dueToday,
  missed,
  upcoming,
}: {
  dueToday: Item[];
  missed: Item[];
  upcoming: Item[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  // Decide the headline item — what to do RIGHT NOW.
  const focusItem: Item | null =
    missed[0] ?? // most-overdue missed item first
    dueToday[0] ?? // first thing due today
    upcoming[0] ?? // next thing on the horizon
    null;

  async function markDone(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/schedule/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5 md:space-y-6">
      {/* Focus card — biggest visual element */}
      {focusItem && (
        <FocusCard item={focusItem} onMarkDone={markDone} busy={busyId === focusItem.id} />
      )}

      {/* Pomodoro timer */}
      {focusItem && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
            Pomodoro
          </h2>
          <PomodoroTimer />
        </div>
      )}

      {/* Remaining today */}
      {dueToday.length > 1 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
            Also today
          </h2>
          <ul className="space-y-2">
            {dueToday
              .filter((i) => i.id !== focusItem?.id)
              .map((item) => (
                <CompactRow
                  key={item.id}
                  item={item}
                  onMarkDone={markDone}
                  busy={busyId === item.id}
                />
              ))}
          </ul>
        </section>
      )}

      {/* Other missed */}
      {missed.length > 1 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
            Other missed
          </h2>
          <ul className="space-y-2">
            {missed
              .filter((i) => i.id !== focusItem?.id)
              .map((item) => (
                <CompactRow
                  key={item.id}
                  item={item}
                  onMarkDone={markDone}
                  busy={busyId === item.id}
                />
              ))}
          </ul>
        </section>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 &&
        upcoming.filter((i) => i.id !== focusItem?.id).length > 0 && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
              Coming up
            </h2>
            <ul className="space-y-2">
              {upcoming
                .filter((i) => i.id !== focusItem?.id)
                .map((item) => (
                  <CompactRow
                    key={item.id}
                    item={item}
                    onMarkDone={markDone}
                    busy={busyId === item.id}
                  />
                ))}
            </ul>
          </section>
        )}
    </div>
  );
}

function FocusCard({
  item,
  onMarkDone,
  busy,
}: {
  item: Item;
  onMarkDone: (id: string) => void;
  busy: boolean;
}) {
  const isOverdue = item.daysUntil < 0;
  const isToday = item.daysUntil === 0;

  return (
    <div className="card p-6 md:p-7 bg-gradient-to-br from-white to-brand-50/40 dark:from-slate-900 dark:to-brand-950/30 dark:border-slate-800">
      <div className="flex items-start gap-4">
        <div
          className="h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 shadow-md"
          style={{
            backgroundColor: item.typeBg,
            border: `1px solid ${item.typeColor}33`,
          }}
        >
          <span className="text-3xl" aria-hidden>
            {item.typeIcon}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span
              className="inline-flex items-center text-[11px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5"
              style={{
                backgroundColor: item.typeBg,
                color: item.typeText,
              }}
            >
              {item.typeLabel}
            </span>
            {item.subject && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: item.subject.color }}
                  aria-hidden
                />
                {item.subject.name}
              </span>
            )}
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-50 leading-tight">
            {item.title}
          </h2>
          <div
            className={`mt-1 text-sm font-medium ${
              isOverdue
                ? "text-red-600 dark:text-red-400"
                : isToday
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-slate-500 dark:text-slate-400"
            }`}
          >
            Due {dueText(item)}
            {item.estMinutes ? ` · ~${item.estMinutes} min` : ""}
          </div>
          {item.notes && (
            <p className="mt-3 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
              {item.notes}
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              className="btn-primary"
              onClick={() => onMarkDone(item.id)}
              disabled={busy}
            >
              {busy ? "…" : "✓ Mark done"}
            </button>
            <Link href="/chat" className="btn-secondary">
              🤖 Ask AI for help
            </Link>
            <Link href="/schedule" className="btn-ghost text-sm">
              All scheduled →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function CompactRow({
  item,
  onMarkDone,
  busy,
}: {
  item: Item;
  onMarkDone: (id: string) => void;
  busy: boolean;
}) {
  return (
    <li className="card p-3 flex items-center gap-3">
      <span
        className="h-9 w-1.5 rounded-full shrink-0"
        style={{ backgroundColor: item.subject?.color ?? "#94a3b8" }}
        aria-hidden
      />
      <span className="text-xl" aria-hidden>
        {item.typeIcon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
          {item.title}
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {item.subject?.name ?? "No subject"} · {item.typeLabel} ·{" "}
          {dueText(item)}
        </div>
      </div>
      <button
        className="btn-ghost text-xs"
        onClick={() => onMarkDone(item.id)}
        disabled={busy}
        title="Mark done"
      >
        {busy ? "…" : "✓"}
      </button>
    </li>
  );
}
