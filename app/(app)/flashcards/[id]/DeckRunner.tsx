"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Card = {
  id: string;
  front: string;
  back: string;
  hint: string | null;
};

type Mode = "study" | "edit";

export default function DeckRunner({
  deckId,
  cards: initialCards,
}: {
  deckId: string;
  cards: Card[];
}) {
  const router = useRouter();
  const [cards, setCards] = useState<Card[]>(initialCards);
  const [mode, setMode] = useState<Mode>(initialCards.length > 0 ? "study" : "edit");
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  // Edit-mode add-card form
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [hint, setHint] = useState("");
  const [adding, setAdding] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    setFlipped(false);
  }, [index, mode]);

  function next() {
    if (index < cards.length - 1) setIndex(index + 1);
    else setIndex(0);
  }
  function prev() {
    if (index > 0) setIndex(index - 1);
    else setIndex(cards.length - 1);
  }

  // Keyboard shortcuts in study mode
  useEffect(() => {
    if (mode !== "study") return;
    function onKey(e: KeyboardEvent) {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === "ArrowRight") {
        next();
      } else if (e.key === "ArrowLeft") {
        prev();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, index, cards.length]);

  async function addCard(e: React.FormEvent) {
    e.preventDefault();
    setEditError(null);
    setAdding(true);
    try {
      const res = await fetch(`/api/flashcards/${deckId}/cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          front: front.trim(),
          back: back.trim(),
          hint: hint.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error ?? "Could not add card.");
      } else {
        setCards((prev) => [...prev, data.card]);
        setFront("");
        setBack("");
        setHint("");
        router.refresh();
      }
    } catch {
      setEditError("Network error. Try again.");
    }
    setAdding(false);
  }

  async function deleteCard(id: string) {
    if (!confirm("Delete this card?")) return;
    const res = await fetch(`/api/flashcards/cards/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setCards((prev) => prev.filter((c) => c.id !== id));
      if (index >= cards.length - 1) setIndex(0);
      router.refresh();
    }
  }

  // ── Empty deck UI ──────────────────────────────────────────────────────
  if (cards.length === 0 && mode === "study") {
    return (
      <div className="card p-8 text-center">
        <div className="text-5xl mb-3">🃏</div>
        <h2 className="text-lg font-semibold text-slate-900">
          No cards in this deck yet
        </h2>
        <p className="text-slate-600 mt-2 max-w-md mx-auto">
          Add your first card to start studying.
        </p>
        <button className="btn-primary mt-4" onClick={() => setMode("edit")}>
          Add cards
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="flex gap-2">
        <button
          className={mode === "study" ? "btn-primary" : "btn-secondary"}
          onClick={() => setMode("study")}
          disabled={cards.length === 0}
        >
          Study
        </button>
        <button
          className={mode === "edit" ? "btn-primary" : "btn-secondary"}
          onClick={() => setMode("edit")}
        >
          Edit cards
        </button>
      </div>

      {mode === "study" && cards.length > 0 && (
        <>
          {/* Progress + flip card */}
          <div className="card p-4">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Card {index + 1} of {cards.length}
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-brand-500 to-purple-500 transition-all duration-500"
                style={{ width: `${((index + 1) / cards.length) * 100}%` }}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setFlipped((f) => !f)}
            className={`card w-full text-left p-8 md:p-12 min-h-[300px] flex flex-col items-center justify-center transition-all duration-300
              hover:shadow-lg active:scale-[0.99] cursor-pointer
              ${
                flipped
                  ? "bg-gradient-to-br from-brand-50 to-purple-50 border-brand-200"
                  : "bg-white"
              }`}
            aria-label={flipped ? "Show front" : "Show back"}
          >
            <div className="text-xs uppercase tracking-wide text-slate-400 mb-3">
              {flipped ? "Back" : "Front"}
            </div>
            <div className="text-xl md:text-2xl font-medium text-slate-900 text-center whitespace-pre-wrap leading-relaxed">
              {flipped ? cards[index].back : cards[index].front}
            </div>
            {!flipped && cards[index].hint && (
              <div className="mt-4 text-xs text-slate-500 text-center">
                💡 {cards[index].hint}
              </div>
            )}
            <div className="mt-6 text-xs text-slate-400">
              Tap card or press space to flip
            </div>
          </button>

          <div className="flex justify-between gap-2">
            <button className="btn-secondary flex-1" onClick={prev}>
              ← Previous
            </button>
            <button className="btn-secondary flex-1" onClick={next}>
              Next →
            </button>
          </div>
          <div className="text-center text-xs text-slate-500">
            ← / → to navigate · space to flip
          </div>
        </>
      )}

      {mode === "edit" && (
        <>
          {/* Add card form */}
          <form onSubmit={addCard} className="card p-4 space-y-3">
            <h2 className="font-semibold text-slate-900">Add a card</h2>
            <div>
              <label className="label">Front</label>
              <textarea
                className="input min-h-[60px]"
                placeholder="Question or prompt"
                value={front}
                onChange={(e) => setFront(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Back</label>
              <textarea
                className="input min-h-[60px]"
                placeholder="Answer or definition"
                value={back}
                onChange={(e) => setBack(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Hint (optional)</label>
              <input
                className="input"
                placeholder="Shown on the front while studying"
                value={hint}
                onChange={(e) => setHint(e.target.value)}
              />
            </div>
            {editError && <p className="text-sm text-red-600">{editError}</p>}
            <button
              type="submit"
              className="btn-primary w-full"
              disabled={adding || !front.trim() || !back.trim()}
            >
              {adding ? "Adding…" : "+ Add card"}
            </button>
          </form>

          {cards.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Cards in this deck
              </h2>
              <ul className="space-y-2">
                {cards.map((c, i) => (
                  <li
                    key={c.id}
                    className="card p-3 flex gap-3 items-start"
                  >
                    <span className="text-xs text-slate-400 font-mono w-6 shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-900 line-clamp-2">
                        {c.front}
                      </div>
                      <div className="text-xs text-slate-600 mt-1 line-clamp-2">
                        {c.back}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteCard(c.id)}
                      className="btn-ghost text-xs text-red-600 hover:bg-red-50 shrink-0"
                      aria-label="Delete card"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
