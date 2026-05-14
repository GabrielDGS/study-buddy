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

  // expanded subject ID — null means none expanded for editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

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

  function openEditor(s: Subject) {
    setEditingId(s.id);
    setEditName(s.name);
    setEditColor(s.color);
    setEditNotes(s.notes ?? "");
    setEditError(null);
    setSaved(false);
  }

  function closeEditor() {
    setEditingId(null);
    setEditError(null);
    setSaved(false);
  }

  async function saveEdit(id: string) {
    setEditError(null);
    setEditBusy(true);
    try {
      const res = await fetch(`/api/subjects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          color: editColor,
          notes: editNotes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error ?? "Could not save subject.");
      } else {
        setSubjects((prev) =>
          prev.map((s) => (s.id === id ? { ...s, ...data.subject } : s))
        );
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
        router.refresh();
      }
    } catch {
      setEditError("Network error. Try again.");
    }
    setEditBusy(false);
  }

  async function deleteSubject(id: string) {
    if (
      !confirm(
        "Delete this subject? Schedule items linked to it will keep working but lose the subject reference."
      )
    ) {
      return;
    }
    const res = await fetch(`/api/subjects/${id}`, { method: "DELETE" });
    if (res.ok) {
      setSubjects((prev) => prev.filter((s) => s.id !== id));
      if (editingId === id) closeEditor();
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      {subjects.length === 0 && !adding ? (
        <div className="card p-8 text-center text-slate-500 dark:text-slate-400">
          No subjects yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {subjects.map((s) => {
            const isEditing = editingId === s.id;
            return (
              <li key={s.id} className="card overflow-hidden">
                <div className="p-4 flex items-start gap-3">
                  <span
                    className="h-10 w-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: s.color }}
                    aria-hidden
                  />
                  <button
                    onClick={() => (isEditing ? closeEditor() : openEditor(s))}
                    className="flex-1 min-w-0 text-left group"
                  >
                    <div className="font-medium text-slate-900 dark:text-slate-100 group-hover:text-brand-700 dark:group-hover:text-brand-400 transition-colors">
                      {s.name}
                    </div>
                    {s.notes && !isEditing && (
                      <div className="text-sm text-slate-600 dark:text-slate-400 mt-1 line-clamp-2 whitespace-pre-wrap">
                        {s.notes}
                      </div>
                    )}
                    {!s.notes && !isEditing && (
                      <div className="text-xs text-slate-400 dark:text-slate-500 mt-1 italic">
                        No notes — click to add
                      </div>
                    )}
                  </button>
                  <button
                    className="btn-ghost text-xs"
                    onClick={() => (isEditing ? closeEditor() : openEditor(s))}
                  >
                    {isEditing ? "▲" : "✎ Edit"}
                  </button>
                </div>

                {isEditing && (
                  <div className="border-t border-slate-200/70 dark:border-slate-700/70 p-4 space-y-3 bg-slate-50/50 dark:bg-slate-800/30 animate-fade-in">
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={editColor}
                        onChange={(e) => setEditColor(e.target.value)}
                        className="h-9 w-12 rounded border border-slate-300 dark:border-slate-600 cursor-pointer"
                        aria-label="Color"
                      />
                      <input
                        className="input"
                        placeholder="Subject name"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label">Notes</label>
                      <textarea
                        className="input min-h-[140px] font-mono text-sm"
                        placeholder={
                          "Your study notes, formulas, cheatsheets, anything to remember.\n\nThis text shows up in the AI's context so it can answer subject-specific questions better."
                        }
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                      />
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Tip: Notes are read by the AI Helper so it can answer
                        with knowledge of your class.
                      </p>
                    </div>
                    {editError && (
                      <p className="text-sm text-red-600 dark:text-red-400">
                        {editError}
                      </p>
                    )}
                    <div className="flex gap-2 items-center">
                      <button
                        className="btn-ghost text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 text-sm"
                        onClick={() => deleteSubject(s.id)}
                      >
                        🗑 Delete
                      </button>
                      <div className="flex-1" />
                      {saved && (
                        <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                          ✓ Saved
                        </span>
                      )}
                      <button
                        className="btn-secondary text-sm"
                        onClick={closeEditor}
                        disabled={editBusy}
                      >
                        Close
                      </button>
                      <button
                        className="btn-primary text-sm"
                        onClick={() => saveEdit(s.id)}
                        disabled={editBusy || !editName.trim()}
                      >
                        {editBusy ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {adding ? (
        <form onSubmit={addSubject} className="card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-12 rounded border border-slate-300 dark:border-slate-600 cursor-pointer"
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
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
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
