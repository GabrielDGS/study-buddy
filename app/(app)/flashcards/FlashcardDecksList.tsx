"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Subject = { id: string; name: string; color: string };

type Deck = {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
  cardCount: number;
  subject: Subject | null;
};

export default function FlashcardDecksList({
  initial,
  subjects,
}: {
  initial: Deck[];
  subjects: Subject[];
}) {
  const router = useRouter();
  const [decks, setDecks] = useState<Deck[]>(initial);

  // Manual create
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subjectId, setSubjectId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AI generate
  const [aiOpen, setAiOpen] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiSubjectId, setAiSubjectId] = useState<string>(subjects[0]?.id ?? "");
  const [aiCount, setAiCount] = useState<string>("12");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  async function createDeck(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          subjectId: subjectId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create deck.");
      } else {
        router.push(`/flashcards/${data.deck.id}`);
      }
    } catch {
      setError("Network error. Try again.");
    }
    setBusy(false);
  }

  async function generateAiDeck(e: React.FormEvent) {
    e.preventDefault();
    setAiError(null);
    setAiBusy(true);
    try {
      const res = await fetch("/api/flashcards/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: aiTopic.trim(),
          subjectId: aiSubjectId || null,
          count: Number(aiCount) || 12,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.deckUrl) {
        setAiError(data.error ?? "Could not generate deck.");
      } else {
        router.push(data.deckUrl);
      }
    } catch {
      setAiError("Network error. Try again.");
    }
    setAiBusy(false);
  }

  async function deleteDeck(id: string, title: string) {
    if (!confirm(`Delete "${title}" and all its cards?`)) return;
    const res = await fetch(`/api/flashcards/${id}`, { method: "DELETE" });
    if (res.ok) {
      setDecks((prev) => prev.filter((d) => d.id !== id));
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* AI generation card */}
        <div className="card p-5 bg-gradient-to-br from-brand-50/80 via-purple-50/60 to-pink-50/40 border-brand-100/80">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl" aria-hidden>🤖</span>
                <h2 className="font-semibold text-slate-900">AI-built deck</h2>
              </div>
              <p className="text-sm text-slate-600 mt-1">
                Tell Claude a topic and get a ready-to-study deck.
              </p>
            </div>
            {aiOpen ? null : (
              <button
                className="btn-primary text-sm"
                onClick={() => setAiOpen(true)}
              >
                Build with AI
              </button>
            )}
          </div>

          {aiOpen && (
            <form onSubmit={generateAiDeck} className="space-y-3 mt-3">
              <div>
                <label className="label">Topic (be specific!)</label>
                <input
                  className="input"
                  placeholder="e.g. AP Bio – Cell Respiration: glycolysis steps & products"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select
                  className="input"
                  value={aiSubjectId}
                  onChange={(e) => setAiSubjectId(e.target.value)}
                >
                  <option value="">No subject</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  className="input"
                  value={aiCount}
                  onChange={(e) => setAiCount(e.target.value)}
                  min={4}
                  max={30}
                  placeholder="# of cards"
                />
              </div>
              {aiError && (
                <p className="text-sm text-red-600">{aiError}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-secondary flex-1"
                  onClick={() => {
                    setAiOpen(false);
                    setAiError(null);
                  }}
                  disabled={aiBusy}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1"
                  disabled={aiBusy || !aiTopic.trim()}
                >
                  {aiBusy ? "Building…" : "Generate"}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Manual create card */}
        <div className="card p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl" aria-hidden>✍️</span>
                <h2 className="font-semibold text-slate-900">Make your own</h2>
              </div>
              <p className="text-sm text-slate-600 mt-1">
                Create an empty deck and add cards yourself.
              </p>
            </div>
            {creating ? null : (
              <button
                className="btn-secondary text-sm"
                onClick={() => setCreating(true)}
              >
                New deck
              </button>
            )}
          </div>

          {creating && (
            <form onSubmit={createDeck} className="space-y-3 mt-3">
              <input
                className="input"
                placeholder="Deck title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                autoFocus
              />
              <input
                className="input"
                placeholder="Description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
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
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-ghost flex-1"
                  onClick={() => {
                    setCreating(false);
                    setError(null);
                  }}
                  disabled={busy}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1"
                  disabled={busy || !title.trim()}
                >
                  {busy ? "Creating…" : "Create deck"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {decks.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-5xl mb-3">🃏</div>
          <h2 className="text-lg font-semibold text-slate-900">
            No decks yet
          </h2>
          <p className="text-slate-600 mt-2 max-w-md mx-auto">
            Build your first deck above — tell the AI a specific topic, or make
            one yourself card by card.
          </p>
        </div>
      ) : (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-3">
            Your decks
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {decks.map((d) => (
              <li
                key={d.id}
                className="card p-4 flex items-start gap-3"
              >
                <span
                  className="h-12 w-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: d.subject?.color ?? "#94a3b8" }}
                  aria-hidden
                />
                <Link
                  href={`/flashcards/${d.id}`}
                  className="flex-1 min-w-0 group"
                >
                  <div className="font-medium text-slate-900 truncate group-hover:text-brand-700 transition-colors">
                    {d.title}
                  </div>
                  <div className="text-xs text-slate-500">
                    {d.subject?.name ?? "No subject"} · {d.cardCount} card
                    {d.cardCount === 1 ? "" : "s"}
                  </div>
                  {d.description && (
                    <div className="text-xs text-slate-500 mt-1 line-clamp-2">
                      {d.description}
                    </div>
                  )}
                </Link>
                <button
                  onClick={() => deleteDeck(d.id, d.title)}
                  className="btn-ghost text-xs text-red-600 hover:bg-red-50"
                  aria-label="Delete deck"
                >
                  🗑️
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
