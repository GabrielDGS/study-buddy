"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Subject = { id: string; name: string };

export default function MakeQuizForm({ subjects }: { subjects: Subject[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [subjectId, setSubjectId] = useState<string>(subjects[0]?.id ?? "");
  const [topic, setTopic] = useState("");
  const [subtopics, setSubtopics] = useState("");
  const [difficulty, setDifficulty] =
    useState<"easy" | "medium" | "hard" | "mixed">("mixed");
  const [count, setCount] = useState<string>("10");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/quizzes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(),
          subtopics: subtopics.trim(),
          subjectId: subjectId || null,
          difficulty,
          count: Number(count) || 10,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.quizUrl) {
        setError(data.error ?? "Could not generate quiz.");
      } else {
        router.push(data.quizUrl);
      }
    } catch {
      setError("Network error. Try again.");
    }
    setBusy(false);
  }

  if (!open) {
    return (
      <button
        className="btn-primary w-full md:w-auto"
        onClick={() => setOpen(true)}
      >
        🤖 Make a quiz with AI
      </button>
    );
  }

  return (
    <div className="card p-5 space-y-4 bg-gradient-to-br from-brand-50/80 via-purple-50/60 to-pink-50/40 border-brand-100/80">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <span aria-hidden>🤖</span> Make a quiz
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            The more specific you are, the better the questions get.
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

      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="label">Subject</label>
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

        <div>
          <label className="label">Topic — be specific</label>
          <input
            className="input"
            placeholder="e.g. AP Calc BC – Chapter 5: Integration by Substitution (NOT just 'calculus')"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div>
          <label className="label">
            Sub-topics or learning objectives (optional, but helps a lot)
          </label>
          <textarea
            className="input min-h-[80px]"
            placeholder={
              "e.g. u-substitution, when to use it, how to handle the bounds in definite integrals, identifying the right u for trig functions, common pitfalls"
            }
            value={subtopics}
            onChange={(e) => setSubtopics(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Difficulty</label>
            <select
              className="input"
              value={difficulty}
              onChange={(e) =>
                setDifficulty(
                  e.target.value as "easy" | "medium" | "hard" | "mixed"
                )
              }
            >
              <option value="mixed">Mixed</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <div>
            <label className="label"># of questions</label>
            <input
              type="number"
              min={4}
              max={15}
              className="input"
              value={count}
              onChange={(e) => setCount(e.target.value)}
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          className="btn-primary w-full"
          disabled={busy || topic.trim().length < 5}
        >
          {busy ? "Generating quiz…" : "Generate quiz"}
        </button>
      </form>
    </div>
  );
}
