"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Subject = {
  id: string;
  name: string;
  color: string;
  notes: string | null;
};

const PALETTE = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#6366f1",
];

export default function SubjectsManager({
  initialSubjects,
}: {
  initialSubjects: Subject[];
}) {
  const router = useRouter();
  const [subjects, setSubjects] = useState<Subject[]>(initialSubjects);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PALETTE[subjects.length % PALETTE.length]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function addSubject(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          color,
          notes: notes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not add subject.");
      } else {
        setSubjects((prev) => [...prev, data.subject]);
        setName("");
        setNotes("");
        setColor(PALETTE[(subjects.length + 1) % PALETTE.length]);
        setAdding(false);
        router.refresh();
      }
    } catch {
      setError("Network error. Try again.");
    }
    setBusy(false);
  }

  async function deleteSubject(id: string) {
    if (!confirm("Delete this subject? Schedule items linked to it will keep working but lose the subject reference.")) {
      return;
    }
    const res = await fetch(`/api/subjects/${id}`, { method: "DELETE" });
    if (res.ok) {
      setSubjects((prev) => prev.filter((s) => s.id !== id));
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      {subjects.length === 0 && !adding ? (
        <div className="card p-8 text-center text-slate-500">
          No subjects yet.
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {subjects.map((s) => (
            <li key={s.id} className="card p-4 flex items-start gap-3">
              <span
                className="h-10 w-1.5 rounded-full shrink-0"
                style={{ backgroundColor: s.color }}
                aria-hidden
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-900">{s.name}</div>
                {s.notes && (
                  <div className="text-sm text-slate-600 mt-1">{s.notes}</div>
                )}
              </div>
              <button
                className="btn-ghost text-red-600 text-xs"
                onClick={() => deleteSubject(s.id)}
                aria-label="Delete subject"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <form onSubmit={addSubject} className="card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-12 rounded border border-slate-300 cursor-pointer"
              aria-label="Color"
            />
            <input
              className="input"
              placeholder="Subject name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <textarea
            className="input min-h-[80px]"
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary flex-1"
              onClick={() => {
                setAdding(false);
                setError(null);
              }}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={busy}>
              {busy ? "Saving…" : "Add subject"}
            </button>
          </div>
        </form>
      ) : (
        <button
          className="btn-secondary w-full"
          onClick={() => setAdding(true)}
        >
          + Add subject
        </button>
      )}
    </div>
  );
}
