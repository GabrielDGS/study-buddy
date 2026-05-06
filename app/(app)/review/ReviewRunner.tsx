"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import confetti from "canvas-confetti";

const MAX_ATTEMPTS = 3;
const LEVEL_LABELS = ["1 day", "3 days", "7 days", "14 days", "30 days"];

type ReviewItem = {
  reviewId: string;
  level: number;
  nextReviewAt: string;
  question: {
    id: string;
    prompt: string;
    type: string;
    imageUrl: string | null;
    options: string[];
    correctAnswer: string;
    explanation: string | null;
  };
  quiz: { id: string; title: string };
};

type Phase = "answering" | "wrong" | "revealed" | "correct";

function normalize(s: string | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

export default function ReviewRunner({
  reviews,
  upcomingCount,
}: {
  reviews: ReviewItem[];
  upcomingCount: number;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("answering");
  const [draft, setDraft] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [results, setResults] = useState<
    { questionId: string; firstTry: boolean; revealed: boolean }[]
  >([]);
  const firedConfettiRef = useRef(false);

  useEffect(() => {
    if (completed && !firedConfettiRef.current && results.length > 0) {
      firedConfettiRef.current = true;
      confetti({
        particleCount: 90,
        spread: 70,
        origin: { x: 0.5, y: 0.6 },
        colors: ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b"],
      });
    }
  }, [completed, results.length]);

  if (reviews.length === 0) return null;

  if (completed) {
    const firstTry = results.filter((r) => r.firstTry).length;
    const total = results.length;
    return (
      <div className="card p-8 text-center animate-fade-in-up">
        <div className="text-6xl mb-3">🎯</div>
        <h2 className="text-2xl font-bold text-slate-900">Review session done</h2>
        <p className="text-slate-600 mt-3 max-w-md mx-auto">
          You got <span className="font-semibold">{firstTry} of {total}</span>{" "}
          right on the first try. Got-right questions move to a longer interval;
          missed questions reset to 1 day.
        </p>
        {upcomingCount > 0 && (
          <p className="text-sm text-slate-500 mt-2">
            {upcomingCount} more review
            {upcomingCount === 1 ? "" : "s"} scheduled for later.
          </p>
        )}
        <div className="mt-6 flex gap-3 justify-center">
          <button
            className="btn-secondary"
            onClick={() => router.push("/dashboard")}
          >
            Back to dashboard
          </button>
          <button
            className="btn-primary"
            onClick={() => router.refresh()}
          >
            Refresh queue
          </button>
        </div>
      </div>
    );
  }

  const r = reviews[index];
  const q = r.question;
  const isLast = index === reviews.length - 1;

  async function recordAnswer(correct: boolean) {
    try {
      await fetch("/api/reviews/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: q.id, correct }),
      });
    } catch {
      /* ignore */
    }
  }

  function submit() {
    if (!draft) return;
    const correct = normalize(draft) === normalize(q.correctAnswer);
    const nextAttempts = attempts + 1;

    if (correct) {
      setAttempts(nextAttempts);
      setPhase("correct");
      const firstTry = nextAttempts === 1;
      setResults((prev) => [
        ...prev,
        { questionId: q.id, firstTry, revealed: false },
      ]);
      // If it was the first try, mark correct (level up). If they had to retry,
      // still record as correct so it advances — they did get it eventually.
      recordAnswer(true);
      return;
    }

    if (nextAttempts >= MAX_ATTEMPTS) {
      setAttempts(nextAttempts);
      setPhase("revealed");
      setResults((prev) => [
        ...prev,
        { questionId: q.id, firstTry: false, revealed: true },
      ]);
      recordAnswer(false);
    } else {
      setAttempts(nextAttempts);
      setPhase("wrong");
    }
  }

  function tryAgain() {
    setDraft("");
    setPhase("answering");
  }

  function next() {
    if (isLast) {
      setCompleted(true);
    } else {
      setIndex(index + 1);
      setDraft("");
      setPhase("answering");
      setAttempts(0);
    }
  }

  const progressPct =
    ((index + (phase === "correct" || phase === "revealed" ? 1 : 0)) /
      reviews.length) *
    100;

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Review {index + 1} of {reviews.length}
          </span>
          <span className="text-xs text-slate-500">
            From{" "}
            <Link
              href={`/quizzes/${r.quiz.id}`}
              className="text-brand-600 hover:underline"
            >
              {r.quiz.title}
            </Link>
            {r.level > 0 && (
              <>
                {" "}
                · Level {r.level + 1} (next interval{" "}
                {LEVEL_LABELS[Math.min(r.level + 1, LEVEL_LABELS.length - 1)]})
              </>
            )}
          </span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-brand-500 to-purple-500 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div key={index} className="card p-6 animate-fade-in-up">
        <div className="font-semibold text-lg text-slate-900">{q.prompt}</div>
        {q.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={q.imageUrl}
            alt=""
            className="mt-3 max-h-64 rounded-lg border border-slate-200"
          />
        )}

        <div className="mt-5">
          {q.type === "multiple_choice" && (
            <div className="space-y-2">
              {q.options.map((opt) => {
                const isChosen = draft === opt;
                const isCorrect = normalize(opt) === normalize(q.correctAnswer);
                const revealCorrect =
                  phase === "correct" || phase === "revealed";
                const markChosenWrong = phase === "wrong" && isChosen;
                let style = "border-slate-200";
                if (isChosen && phase === "answering")
                  style = "border-brand-500 bg-brand-50";
                if (revealCorrect && isCorrect)
                  style = "border-emerald-500 bg-emerald-50";
                if (revealCorrect && isChosen && !isCorrect)
                  style = "border-red-500 bg-red-50";
                if (markChosenWrong) style = "border-red-500 bg-red-50";
                const disabled = phase !== "answering";
                return (
                  <label
                    key={opt}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${style} ${
                      disabled ? "" : "hover:border-brand-400"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`q-${q.id}`}
                      value={opt}
                      checked={isChosen}
                      onChange={(e) => setDraft(e.target.value)}
                      disabled={disabled}
                      className="text-brand-600"
                    />
                    <span className="text-sm">{opt}</span>
                    {revealCorrect && isCorrect && (
                      <span className="ml-auto text-emerald-600 text-sm font-medium">
                        ✓
                      </span>
                    )}
                    {(markChosenWrong ||
                      (revealCorrect && isChosen && !isCorrect)) && (
                      <span className="ml-auto text-red-600 text-sm font-medium">
                        ✗
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          )}

          {q.type === "true_false" && (
            <div className="grid grid-cols-2 gap-3">
              {["True", "False"].map((opt) => {
                const isChosen = draft === opt;
                const isCorrect = normalize(opt) === normalize(q.correctAnswer);
                const revealCorrect =
                  phase === "correct" || phase === "revealed";
                const markChosenWrong = phase === "wrong" && isChosen;
                let style = "btn-secondary";
                if (revealCorrect && isCorrect)
                  style = "btn bg-emerald-500 text-white shadow-md";
                else if (revealCorrect && isChosen && !isCorrect)
                  style = "btn bg-red-500 text-white shadow-md";
                else if (markChosenWrong)
                  style = "btn bg-red-500 text-white shadow-md";
                else if (isChosen) style = "btn-primary";
                return (
                  <button
                    key={opt}
                    type="button"
                    disabled={phase !== "answering"}
                    onClick={() => setDraft(opt)}
                    className={style}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          )}

          {q.type === "short_answer" && (
            <input
              className="input text-base"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={phase !== "answering"}
              placeholder="Type your answer"
              onKeyDown={(e) => {
                if (e.key === "Enter" && phase === "answering") {
                  e.preventDefault();
                  submit();
                }
              }}
              autoFocus
            />
          )}
        </div>

        {phase === "wrong" && (
          <div className="mt-4 p-4 rounded-lg bg-red-50 border border-red-200 animate-fade-in">
            <div className="font-semibold text-red-800 flex items-center gap-2">
              <span>❌</span> Not quite — try again.
            </div>
            <div className="text-xs text-red-700 mt-1">
              {MAX_ATTEMPTS - attempts} attempt
              {MAX_ATTEMPTS - attempts === 1 ? "" : "s"} left before the answer
              is revealed.
            </div>
          </div>
        )}

        {phase === "correct" && (
          <div className="mt-4 p-4 rounded-lg bg-emerald-50 border border-emerald-200 animate-fade-in">
            <div className="font-semibold text-emerald-800 flex items-center gap-2">
              <span>✅</span> Correct
              {attempts === 1 ? " on the first try!" : "!"}
            </div>
            {q.explanation && (
              <div className="mt-1.5 text-sm text-emerald-900/80">
                {q.explanation}
              </div>
            )}
            <div className="mt-2 text-xs text-emerald-800/70">
              {attempts === 1
                ? "Great — bumping this question to a longer interval."
                : "Recorded — but since it took retries, the interval stays modest."}
            </div>
          </div>
        )}

        {phase === "revealed" && (
          <div className="mt-4 p-4 rounded-lg bg-amber-50 border border-amber-200 animate-fade-in">
            <div className="font-semibold text-amber-900 flex items-center gap-2">
              <span>💡</span> Out of attempts — the answer is:{" "}
              <span className="font-bold">{q.correctAnswer}</span>
            </div>
            {q.explanation && (
              <div className="mt-1.5 text-sm text-amber-900/80">
                {q.explanation}
              </div>
            )}
            <div className="mt-2 text-xs text-amber-800/70">
              This question is reset — you&apos;ll see it again tomorrow.
            </div>
          </div>
        )}

        <div className="mt-5 flex gap-2 flex-wrap">
          {phase === "answering" && (
            <button className="btn-primary" onClick={submit} disabled={!draft}>
              Submit answer
            </button>
          )}
          {phase === "wrong" && (
            <button className="btn-primary" onClick={tryAgain}>
              Try again
            </button>
          )}
          {(phase === "correct" || phase === "revealed") && (
            <button className="btn-primary" onClick={next}>
              {isLast ? "Finish session" : "Next question →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
