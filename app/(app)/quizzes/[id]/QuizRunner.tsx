"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";

const MAX_ATTEMPTS = 3;

function fireConfetti(perfect: boolean) {
  const baseDefaults = { spread: 70, ticks: 200, gravity: 0.9, scalar: 1 };
  if (perfect) {
    // Triple burst for a perfect score
    const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
    confetti({
      ...baseDefaults,
      particleCount: 120,
      origin: { x: 0.5, y: 0.55 },
      colors,
    });
    setTimeout(
      () =>
        confetti({
          ...baseDefaults,
          particleCount: 80,
          origin: { x: 0.2, y: 0.65 },
          angle: 60,
          colors,
        }),
      150
    );
    setTimeout(
      () =>
        confetti({
          ...baseDefaults,
          particleCount: 80,
          origin: { x: 0.8, y: 0.65 },
          angle: 120,
          colors,
        }),
      300
    );
  } else {
    confetti({
      ...baseDefaults,
      particleCount: 80,
      origin: { x: 0.5, y: 0.6 },
      colors: ["#3b82f6", "#10b981", "#8b5cf6"],
    });
  }
}

type Question = {
  id: string;
  prompt: string;
  type: string;
  imageUrl: string | null;
  options: string[];
  correctAnswer: string;
  explanation: string | null;
};

type Phase = "answering" | "wrong" | "revealed" | "correct";

type Stats = {
  attempts: number;
  revealed: boolean;
  gotRight: boolean; // true if first answer was correct (without reveal)
};

function normalize(s: string | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

export default function QuizRunner({
  quizId,
  questions,
}: {
  quizId: string;
  questions: Question[];
}) {
  const router = useRouter();

  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("answering");
  const [draft, setDraft] = useState<string>("");
  const initialStats = useMemo<Stats[]>(
    () => questions.map(() => ({ attempts: 0, revealed: false, gotRight: false })),
    [questions]
  );
  const [stats, setStats] = useState<Stats[]>(initialStats);
  const [completed, setCompleted] = useState(false);
  const firedConfettiRef = useRef(false);
  const scheduledReviewRef = useRef(false);
  const [generatingReview, setGeneratingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Fire confetti + batch-schedule missed questions on completion.
  useEffect(() => {
    if (!completed) return;
    if (!firedConfettiRef.current) {
      firedConfettiRef.current = true;
      const perfect =
        stats.length > 0 && stats.every((s) => s.gotRight && !s.revealed);
      fireConfetti(perfect);
    }

    if (!scheduledReviewRef.current) {
      scheduledReviewRef.current = true;
      // Anything not first-try-correct is a "missed" question.
      const missedIds = questions
        .map((q, i) => ({ q, s: stats[i] }))
        .filter(({ s }) => !s.gotRight || s.attempts > 1 || s.revealed)
        .map(({ q }) => q.id);
      if (missedIds.length > 0) {
        fetch("/api/reviews/schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionIds: missedIds }),
        }).catch(() => {
          /* ignore */
        });
      }
    }
  }, [completed, stats, questions]);

  function getMissedQuestionIds(): string[] {
    return questions
      .map((q, i) => ({ q, s: stats[i] }))
      .filter(({ s }) => !s.gotRight || s.attempts > 1 || s.revealed)
      .map(({ q }) => q.id);
  }

  async function generateReviewQuiz() {
    setReviewError(null);
    setGeneratingReview(true);
    try {
      const missedIds = getMissedQuestionIds();
      const res = await fetch(`/api/quizzes/${quizId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ missedQuestionIds: missedIds }),
      });
      const data = await res.json();
      if (!res.ok || !data.quizUrl) {
        setReviewError(data.error ?? "Could not generate review quiz.");
        setGeneratingReview(false);
        return;
      }
      router.push(data.quizUrl);
    } catch {
      setReviewError("Network error. Try again.");
      setGeneratingReview(false);
    }
  }

  if (questions.length === 0) {
    return (
      <div className="card p-8 text-center text-slate-500">
        This quiz has no questions yet.
      </div>
    );
  }

  if (completed) {
    const correctFirstTry = stats.filter((s) => s.gotRight && !s.revealed).length;
    const eventuallyCorrect = stats.filter((s) => !s.revealed).length;
    const revealedCount = stats.filter((s) => s.revealed).length;
    const total = questions.length;
    const missedCount = getMissedQuestionIds().length;

    return (
      <div className="card p-8 text-center animate-fade-in-up">
        <div className="text-6xl mb-3">🎉</div>
        <h2 className="text-2xl font-bold text-slate-900">Quiz complete!</h2>
        <div className="mt-6 grid grid-cols-3 gap-3 max-w-md mx-auto">
          <ScoreStat
            value={`${correctFirstTry}/${total}`}
            label="First try"
            color="from-emerald-500 to-teal-500"
          />
          <ScoreStat
            value={`${eventuallyCorrect}/${total}`}
            label="Eventually got"
            color="from-brand-500 to-indigo-500"
          />
          <ScoreStat
            value={`${revealedCount}`}
            label="Revealed"
            color="from-amber-500 to-orange-500"
          />
        </div>
        <p className="text-slate-600 mt-6 max-w-md mx-auto">
          {correctFirstTry === total
            ? "Perfect score on the first try! 💯"
            : revealedCount === 0
              ? "Got everything eventually — keep practicing!"
              : "Review what you revealed and try again."}
        </p>

        {missedCount > 0 && (
          <div className="mt-6 p-4 rounded-xl bg-gradient-to-br from-brand-50 to-purple-50 border border-brand-100">
            <div className="flex items-center justify-center gap-2 text-slate-900 font-semibold">
              <span aria-hidden>🧠</span>
              Lock in what you missed
            </div>
            <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
              Generate a review quiz from the {missedCount} question
              {missedCount === 1 ? "" : "s"} you didn&apos;t nail. For
              numerical subjects the AI will give you the same shape with
              different numbers; for verbal subjects it&apos;ll keep them
              the same.
            </p>
            {reviewError && (
              <p className="text-sm text-red-600 mt-2">{reviewError}</p>
            )}
            <button
              className="btn-primary mt-3"
              onClick={generateReviewQuiz}
              disabled={generatingReview}
            >
              {generatingReview ? "Generating…" : "🧠 Make a review quiz"}
            </button>
          </div>
        )}

        <div className="mt-6 flex gap-3 justify-center flex-wrap">
          <button
            className="btn-secondary"
            onClick={() => router.push("/quizzes")}
          >
            Back to quizzes
          </button>
          <button
            className="btn-primary"
            onClick={() => {
              setIndex(0);
              setPhase("answering");
              setDraft("");
              setStats(questions.map(() => ({ attempts: 0, revealed: false, gotRight: false })));
              setCompleted(false);
              firedConfettiRef.current = false;
            }}
          >
            Retake quiz
          </button>
        </div>
      </div>
    );
  }

  const q = questions[index];
  const myStats = stats[index];
  const isLast = index === questions.length - 1;

  function recordStats(patch: Partial<Stats>) {
    setStats((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  function submit() {
    if (!draft) return;
    const correct = normalize(draft) === normalize(q.correctAnswer);
    const nextAttempts = myStats.attempts + 1;

    if (correct) {
      recordStats({ attempts: nextAttempts, gotRight: true });
      setPhase("correct");
      return;
    }

    // Wrong answer — handled in batch on quiz completion.
    if (nextAttempts >= MAX_ATTEMPTS) {
      recordStats({ attempts: nextAttempts, revealed: true });
      setPhase("revealed");
    } else {
      recordStats({ attempts: nextAttempts });
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
    }
  }

  const progress = ((index + (phase === "correct" || phase === "revealed" ? 1 : 0)) / questions.length) * 100;

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Question {index + 1} of {questions.length}
          </span>
          <span className="text-xs text-slate-500">
            {myStats.attempts > 0 && `Attempts: ${myStats.attempts}`}
          </span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-brand-500 to-purple-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question card */}
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
                // Only reveal which option is correct when answered correctly
                // or after the auto-reveal threshold.
                const revealCorrect = phase === "correct" || phase === "revealed";
                // Mark only the user's wrong choice as red on a wrong submission;
                // do NOT highlight the correct option yet.
                const markChosenWrong = phase === "wrong" && isChosen;

                let style = "border-slate-200";
                if (isChosen && phase === "answering") style = "border-brand-500 bg-brand-50";
                if (revealCorrect && isCorrect) style = "border-emerald-500 bg-emerald-50";
                if (revealCorrect && isChosen && !isCorrect) style = "border-red-500 bg-red-50";
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
                      <span className="ml-auto text-emerald-600 text-sm font-medium">✓</span>
                    )}
                    {(markChosenWrong || (revealCorrect && isChosen && !isCorrect)) && (
                      <span className="ml-auto text-red-600 text-sm font-medium">✗</span>
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
                const revealCorrect = phase === "correct" || phase === "revealed";
                const markChosenWrong = phase === "wrong" && isChosen;

                let style = "btn-secondary";
                if (revealCorrect && isCorrect) style = "btn bg-emerald-500 text-white shadow-md";
                else if (revealCorrect && isChosen && !isCorrect)
                  style = "btn bg-red-500 text-white shadow-md";
                else if (markChosenWrong) style = "btn bg-red-500 text-white shadow-md";
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

        {/* Feedback panel */}
        {phase === "wrong" && (
          <div className="mt-4 p-4 rounded-lg bg-red-50 border border-red-200 animate-fade-in">
            <div className="font-semibold text-red-800 flex items-center gap-2">
              <span>❌</span> Not quite — try again.
            </div>
            <div className="text-xs text-red-700 mt-1">
              {MAX_ATTEMPTS - myStats.attempts} attempt
              {MAX_ATTEMPTS - myStats.attempts === 1 ? "" : "s"} left before the
              answer is revealed.
            </div>
          </div>
        )}

        {phase === "correct" && (
          <div className="mt-4 p-4 rounded-lg bg-emerald-50 border border-emerald-200 animate-fade-in">
            <div className="font-semibold text-emerald-800 flex items-center gap-2">
              <span>✅</span> Correct{myStats.attempts === 1 ? " on the first try!" : "!"}
            </div>
            {q.explanation && (
              <div className="mt-1.5 text-sm text-emerald-900/80">{q.explanation}</div>
            )}
          </div>
        )}

        {phase === "revealed" && (
          <div className="mt-4 p-4 rounded-lg bg-amber-50 border border-amber-200 animate-fade-in">
            <div className="font-semibold text-amber-900 flex items-center gap-2">
              <span>💡</span>
              {myStats.attempts >= MAX_ATTEMPTS
                ? `Out of attempts — the answer is:`
                : `Answer:`}{" "}
              <span className="font-bold">{q.correctAnswer}</span>
            </div>
            {q.explanation && (
              <div className="mt-1.5 text-sm text-amber-900/80">
                {q.explanation}
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-5 flex gap-2 flex-wrap">
          {phase === "answering" && (
            <button
              className="btn-primary"
              onClick={submit}
              disabled={!draft}
            >
              Submit answer
            </button>
          )}
          {phase === "wrong" && (
            <>
              <button className="btn-primary" onClick={tryAgain}>
                Try again
              </button>
            </>
          )}
          {(phase === "correct" || phase === "revealed") && (
            <button className="btn-primary" onClick={next}>
              {isLast ? "Finish quiz" : "Next question →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ScoreStat({
  value,
  label,
  color,
}: {
  value: string;
  label: string;
  color: string;
}) {
  return (
    <div className="card p-3">
      <div
        className={`text-2xl font-bold bg-gradient-to-br ${color} bg-clip-text text-transparent`}
      >
        {value}
      </div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </div>
  );
}
