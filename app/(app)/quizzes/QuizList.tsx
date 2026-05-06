"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Quiz = {
  id: string;
  title: string;
  createdAt: string;
  questionCount: number;
  subject: { id: string; name: string; color: string } | null;
};

export default function QuizList({ initial }: { initial: Quiz[] }) {
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<Quiz[]>(initial);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function deleteQuiz(quiz: Quiz) {
    if (
      !confirm(
        `Delete "${quiz.title}"? This will also remove its ${quiz.questionCount} question${quiz.questionCount === 1 ? "" : "s"} and cannot be undone.`
      )
    ) {
      return;
    }
    setDeletingId(quiz.id);
    try {
      const res = await fetch(`/api/quizzes/${quiz.id}`, { method: "DELETE" });
      if (res.ok) {
        setQuizzes((prev) => prev.filter((q) => q.id !== quiz.id));
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Could not delete quiz.");
      }
    } catch {
      alert("Network error.");
    }
    setDeletingId(null);
  }

  if (quizzes.length === 0) {
    return (
      <div className="card p-8 text-center">
        <div className="text-5xl mb-3">📝</div>
        <h2 className="text-lg font-semibold text-slate-900">No quizzes yet</h2>
        <p className="text-slate-600 mt-2 max-w-md mx-auto">
          Ask the AI Helper to make a practice quiz on any topic — it&apos;ll
          appear here.
        </p>
        <Link href="/chat" className="btn-primary mt-4 inline-flex">
          Open AI Helper
        </Link>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {quizzes.map((q) => (
        <li
          key={q.id}
          className={`card p-4 flex items-center gap-3 transition-opacity ${
            deletingId === q.id ? "opacity-50 pointer-events-none" : ""
          }`}
        >
          <span
            className="h-10 w-1.5 rounded-full shrink-0"
            style={{ backgroundColor: q.subject?.color ?? "#94a3b8" }}
            aria-hidden
          />
          <Link
            href={`/quizzes/${q.id}`}
            className="flex-1 min-w-0 group"
          >
            <div className="font-medium text-slate-900 truncate group-hover:text-brand-700 transition-colors">
              {q.title}
            </div>
            <div className="text-xs text-slate-500">
              {q.subject?.name ?? "No subject"} ·{" "}
              {q.questionCount} question{q.questionCount === 1 ? "" : "s"} ·{" "}
              {new Date(q.createdAt).toLocaleDateString()}
            </div>
          </Link>
          <Link href={`/quizzes/${q.id}`} className="btn-secondary text-sm">
            Open
          </Link>
          <button
            onClick={() => deleteQuiz(q)}
            disabled={deletingId === q.id}
            className="btn-ghost text-sm text-red-600 hover:bg-red-50"
            title="Delete quiz"
            aria-label="Delete quiz"
          >
            🗑️
          </button>
        </li>
      ))}
    </ul>
  );
}
