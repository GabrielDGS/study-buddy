"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { styleForType } from "@/lib/scheduleStyles";

type Subject = { id: string; name: string; color: string };

type Item = {
  id: string;
  title: string;
  type: string;
  subjectId: string | null;
  subject: Subject | null;
  dueDate: string;
  studyStart: string | null;
  estMinutes: number | null;
  status: string;
  notes: string | null;
};

const TYPES = [
  { value: "test", label: "Test" },
  { value: "quiz", label: "Quiz" },
  { value: "assignment", label: "Assignment" },
  { value: "study", label: "Study session" },
];

const TYPE_LABEL: Record<string, string> = Object.fromEntries(
  TYPES.map((t) => [t.value, t.label])
);

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dayKey(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function buildMonthGrid(viewMonth: Date): Date[] {
  const first = startOfMonth(viewMonth);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay()); // back up to Sunday
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

function toLocalInputValue(date: Date): string {
  // YYYY-MM-DDTHH:MM in local time, suitable for <input type="datetime-local">
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function ScheduleManager({
  initialItems,
  subjects,
}: {
  initialItems: Item[];
  subjects: Subject[];
}) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>(initialItems);

  const today = useMemo(() => new Date(), []);
  const [viewMonth, setViewMonth] = useState<Date>(startOfMonth(today));
  const [selectedDay, setSelectedDay] = useState<Date>(today);

  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("test");
  const [subjectId, setSubjectId] = useState<string>(subjects[0]?.id ?? "");
  const [dueDate, setDueDate] = useState("");
  const [estMinutes, setEstMinutes] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const itemsByDay = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const item of items) {
      const key = dayKey(item.dueDate);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    for (const arr of map.values()) {
      arr.sort(
        (a, b) =>
          new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      );
    }
    return map;
  }, [items]);

  const grid = useMemo(() => buildMonthGrid(viewMonth), [viewMonth]);
  const monthLabel = viewMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  function openAddForDay(day: Date) {
    const initial = new Date(day);
    if (isSameDay(day, today)) {
      initial.setHours(today.getHours(), today.getMinutes(), 0, 0);
    } else {
      initial.setHours(15, 0, 0, 0); // default 3:00 PM
    }
    setDueDate(toLocalInputValue(initial));
    setTitle("");
    setType("test");
    setSubjectId(subjects[0]?.id ?? "");
    setEstMinutes("");
    setNotes("");
    setError(null);
    setAdding(true);
  }

  function closeAdd() {
    setAdding(false);
    setError(null);
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!dueDate) {
      setError("Pick a due date.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          type,
          subjectId: subjectId || null,
          dueDate: new Date(dueDate).toISOString(),
          estMinutes: estMinutes ? Number(estMinutes) : null,
          notes: notes.trim() || null,
          status: "pending",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not add item.");
      } else {
        const newItem: Item = {
          ...data.item,
          dueDate: new Date(data.item.dueDate).toISOString(),
          studyStart: data.item.studyStart
            ? new Date(data.item.studyStart).toISOString()
            : null,
        };
        setItems((prev) => [...prev, newItem]);
        setSelectedDay(new Date(newItem.dueDate));
        setViewMonth(startOfMonth(new Date(newItem.dueDate)));
        closeAdd();
        router.refresh();
      }
    } catch {
      setError("Network error. Try again.");
    }
    setBusy(false);
  }

  async function toggleStatus(item: Item) {
    const next = item.status === "done" ? "pending" : "done";
    const res = await fetch(`/api/schedule/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: next } : i))
      );
      router.refresh();
    }
  }

  async function deleteItem(id: string) {
    if (!confirm("Delete this item?")) return;
    const res = await fetch(`/api/schedule/${id}`, { method: "DELETE" });
    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.id !== id));
      router.refresh();
    }
  }

  const selectedItems = itemsByDay.get(dayKey(selectedDay)) ?? [];

  return (
    <div className="space-y-4">
      <div className="card p-3 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <button
            className="btn-ghost"
            onClick={() => {
              const d = new Date(viewMonth);
              d.setMonth(d.getMonth() - 1);
              setViewMonth(d);
            }}
            aria-label="Previous month"
          >
            ‹
          </button>
          <div className="font-semibold text-slate-900 px-2 min-w-[10rem] text-center">
            {monthLabel}
          </div>
          <button
            className="btn-ghost"
            onClick={() => {
              const d = new Date(viewMonth);
              d.setMonth(d.getMonth() + 1);
              setViewMonth(d);
            }}
            aria-label="Next month"
          >
            ›
          </button>
          <button
            className="btn-ghost text-sm"
            onClick={() => {
              setViewMonth(startOfMonth(today));
              setSelectedDay(today);
            }}
          >
            Today
          </button>
        </div>
        <button
          className="btn-primary"
          onClick={() => openAddForDay(selectedDay)}
        >
          + Add to schedule
        </button>
      </div>

      {adding && (
        <form onSubmit={addItem} className="card p-4 space-y-3">
          <input
            className="input"
            placeholder="Title (e.g. Bio Chapter 7 test)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              className="input"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <select
              className="input"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
            >
              <option value="">No subject</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Due date & time</label>
              <input
                type="datetime-local"
                className="input"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Estimated study minutes</label>
              <input
                type="number"
                min={5}
                step={5}
                className="input"
                value={estMinutes}
                onChange={(e) => setEstMinutes(e.target.value)}
                placeholder="e.g. 60"
              />
            </div>
          </div>
          <textarea
            className="input min-h-[80px]"
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary flex-1"
              onClick={closeAdd}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={busy}>
              {busy ? "Saving…" : "Add to schedule"}
            </button>
          </div>
        </form>
      )}

      <div className="card p-3">
        <div className="flex items-center gap-3 flex-wrap text-xs">
          <span className="text-slate-500 font-medium">Legend:</span>
          {TYPES.map((t) => {
            const ts = styleForType(t.value);
            return (
              <span
                key={t.value}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 border"
                style={{
                  backgroundColor: ts.chipBg,
                  color: ts.chipText,
                  borderColor: ts.chipBorder,
                }}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: ts.solid }}
                  aria-hidden
                />
                <span className="font-medium">{ts.label}</span>
              </span>
            );
          })}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="px-1 sm:px-2 py-2 text-[10px] sm:text-xs font-semibold text-slate-500 text-center"
            >
              <span className="sm:hidden">{d.charAt(0)}</span>
              <span className="hidden sm:inline">{d}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {grid.map((day, idx) => {
            const inMonth = day.getMonth() === viewMonth.getMonth();
            const isToday = isSameDay(day, today);
            const isSelected = isSameDay(day, selectedDay);
            const dayItems = itemsByDay.get(dayKey(day)) ?? [];
            const visibleChips = dayItems.slice(0, 3);
            const overflow = dayItems.length - visibleChips.length;
            const dotsVisible = dayItems.slice(0, 4);
            const dotsOverflow = dayItems.length - dotsVisible.length;

            return (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={`relative text-left min-h-[60px] sm:min-h-[96px] p-1 sm:p-1.5 border-b border-r border-slate-200 transition-colors ${
                  inMonth ? "bg-white" : "bg-slate-50"
                } ${isSelected ? "ring-2 ring-brand-500 ring-inset z-10" : ""}
                  hover:bg-brand-50 focus:outline-none`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex items-center justify-center text-[11px] sm:text-xs font-medium h-5 w-5 sm:h-6 sm:w-6 rounded-full ${
                      isToday
                        ? "bg-brand-600 text-white"
                        : inMonth
                          ? "text-slate-700"
                          : "text-slate-400"
                    }`}
                  >
                    {day.getDate()}
                  </span>
                </div>

                {/* Mobile: just colored dots */}
                <div className="mt-1 flex flex-wrap gap-0.5 sm:hidden">
                  {dotsVisible.map((item) => {
                    const ts = styleForType(item.type);
                    return (
                      <span
                        key={item.id}
                        className={`h-1.5 w-1.5 rounded-full ${
                          item.status === "done" ? "opacity-50" : ""
                        }`}
                        style={{ backgroundColor: ts.solid }}
                        aria-hidden
                      />
                    );
                  })}
                  {dotsOverflow > 0 && (
                    <span className="text-[9px] text-slate-500 leading-none ml-0.5">
                      +{dotsOverflow}
                    </span>
                  )}
                </div>

                {/* Desktop: full chips with title */}
                <div className="mt-1 space-y-0.5 hidden sm:block">
                  {visibleChips.map((item) => {
                    const ts = styleForType(item.type);
                    return (
                      <div
                        key={item.id}
                        className={`flex items-center gap-1 rounded-md text-[11px] px-1.5 py-0.5 truncate border ${
                          item.status === "done" ? "opacity-50 line-through" : ""
                        }`}
                        style={{
                          backgroundColor: ts.chipBg,
                          color: ts.chipText,
                          borderColor: ts.chipBorder,
                        }}
                        title={`${ts.label}: ${item.title}`}
                      >
                        <span aria-hidden className="text-[10px]">
                          {ts.icon}
                        </span>
                        {item.subject && (
                          <span
                            className="h-1.5 w-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: item.subject.color }}
                            aria-hidden
                          />
                        )}
                        <span className="truncate">{item.title}</span>
                      </div>
                    );
                  })}
                  {overflow > 0 && (
                    <div className="text-[11px] text-slate-500 px-1">
                      +{overflow} more
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-900">
            {selectedDay.toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
              year:
                selectedDay.getFullYear() === today.getFullYear()
                  ? undefined
                  : "numeric",
            })}
          </h2>
          <button
            className="btn-ghost text-sm text-brand-600"
            onClick={() => openAddForDay(selectedDay)}
          >
            + Add for this day
          </button>
        </div>
        {selectedItems.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing scheduled.</p>
        ) : (
          <ul className="space-y-2">
            {selectedItems.map((item) => {
              const ts = styleForType(item.type);
              return (
                <li
                  key={item.id}
                  className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                    item.status === "done" ? "opacity-60" : ""
                  }`}
                  style={{
                    backgroundColor: `${ts.chipBg}66`,
                    borderColor: ts.chipBorder,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={item.status === "done"}
                    onChange={() => toggleStatus(item)}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    aria-label="Mark done"
                  />
                  <span
                    className="h-10 w-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: ts.solid }}
                    aria-hidden
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded"
                        style={{
                          backgroundColor: ts.solid,
                          color: "white",
                        }}
                      >
                        {ts.icon} {ts.label}
                      </span>
                      <div
                        className={`font-medium text-slate-900 truncate ${
                          item.status === "done" ? "line-through" : ""
                        }`}
                      >
                        {item.title}
                      </div>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {item.subject ? (
                        <span className="inline-flex items-center gap-1">
                          <span
                            className="h-2 w-2 rounded-full inline-block"
                            style={{ backgroundColor: item.subject.color }}
                            aria-hidden
                          />
                          {item.subject.name}
                        </span>
                      ) : (
                        "No subject"
                      )}
                      {item.estMinutes ? ` · ~${item.estMinutes}m` : ""}
                    </div>
                    {item.notes && (
                      <div className="text-xs text-slate-600 mt-1">
                        {item.notes}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 shrink-0">
                    {new Date(item.dueDate).toLocaleTimeString(undefined, {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </div>
                  <button
                    className="btn-ghost text-red-600 text-xs"
                    onClick={() => deleteItem(item.id)}
                    aria-label="Delete"
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
