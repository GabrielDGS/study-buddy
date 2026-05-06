"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ReviewableQuiz = {
  quizId: string;
  quizTitle: string;
  subjectName: string | null;
  subjectColor: string | null;
  missedCount: number;
};

export default function MistakesToReview({
  initial,
}: {
  initial: ReviewableQuiz[];
}) {
  const router = useRouter();
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (initial.length === 0) return null;

  async function generate(q: ReviewableQuiz) {
    setError(null);
    setGeneratingId(q.quizId);
    try {
      const res = await fetch(`/api/quizzes/${q.quizId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}), // empty body → server uses SR queue
      });
      const data = await res.json();
      if (!res.ok || !data.quizUrl) {
        setError(
          data.error ?? "Could not generate review quiz. Try again later."
        );
      } else {
        router.push(data.quizUrl);
      }
    } catch {
      setError("Network error. Try again.");
    }
    setGeneratingId(null);
  }

  return (
    <section className="card p-6 bg-gradient-to-br from-brand-50/80 via-purple-50/60 to-pink-50/40 border-brand-100/80">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center text-xl shadow-md">
          <span aria-hidden>🧠</span>
        </div>
        <div>
          <h2 className="font-semibold text-slate-900">Mistakes to review</h2>
          <p className="text-sm text-slate-600">
            Lock in concepts you got wrong. Numerical subjects get fresh
            numbers; verbal subjects use the same questions.
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <ul className="space-y-2">
        {initial.map((q) => {
          const isBusy = generatingId === q.quizId;
          return (
            <li
              key={q.quizId}
              className="flex items-center gap-3 rounded-lg bg-white/80 border border-brand-100 p-3"
            >
              <span
                className="h-8 w-1.5 rounded-full"
                style={{ backgroundColor: q.subjectColor ?? "#94a3b8" }}
                aria-hidden
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-900 truncate">
                  {q.quizTitle}
                </div>
                <div className="text-xs text-slate-500">
                  {q.subjectName ?? "No subject"} ·{" "}
                  <span className="text-brand-700 font-medium">
                    {q.missedCount} mistake
                    {q.missedCount === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
              <button
                className="btn-primary text-sm shrink-0"
                onClick={() => generate(q)}
                disabled={isBusy || generatingId !== null}
              >
                {isBusy ? "Generating…" : "Make review quiz"}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
