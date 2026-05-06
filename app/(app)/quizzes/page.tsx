import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import QuizList from "./QuizList";
import MistakesToReview from "./MistakesToReview";
import MakeQuizForm from "./MakeQuizForm";
import FlashcardDecksList from "../flashcards/FlashcardDecksList";

type SearchParams = { tab?: string };

export default async function PracticePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = (await getCurrentUser())!;
  const view: "quizzes" | "flashcards" =
    searchParams.tab === "flashcards" ? "flashcards" : "quizzes";

  const subjects = await prisma.subject.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, color: true },
  });

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-5 md:space-y-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">
          📝 Practice
        </h1>
        <p className="text-base md:text-lg text-slate-600 mt-1.5 md:mt-2">
          Practice quizzes and flashcards — make them yourself or have the AI
          build them.
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex border-b border-slate-200">
        <Link
          href="/quizzes"
          className={`px-4 py-2.5 text-sm font-medium transition-colors -mb-px border-b-2 ${
            view === "quizzes"
              ? "border-brand-500 text-brand-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          📝 Quizzes
        </Link>
        <Link
          href="/quizzes?tab=flashcards"
          className={`px-4 py-2.5 text-sm font-medium transition-colors -mb-px border-b-2 ${
            view === "flashcards"
              ? "border-brand-500 text-brand-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          🃏 Flashcards
        </Link>
      </div>

      {view === "quizzes" ? (
        <QuizzesTab user={user} subjects={subjects} />
      ) : (
        <FlashcardsTab user={user} subjects={subjects} />
      )}
    </div>
  );
}

async function QuizzesTab({
  user,
  subjects,
}: {
  user: { id: string };
  subjects: { id: string; name: string }[];
}) {
  const [quizzes, reviewRows] = await Promise.all([
    prisma.quiz.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        subject: true,
        _count: { select: { questions: true } },
      },
    }),
    prisma.questionReview.findMany({
      where: { userId: user.id },
      include: {
        question: {
          select: {
            quizId: true,
            quiz: {
              select: { id: true, title: true, subject: true },
            },
          },
        },
      },
    }),
  ]);

  const byQuiz = new Map<
    string,
    {
      quizId: string;
      quizTitle: string;
      subjectName: string | null;
      subjectColor: string | null;
      missedCount: number;
    }
  >();
  for (const r of reviewRows) {
    const q = r.question.quiz;
    const existing = byQuiz.get(q.id);
    if (existing) {
      existing.missedCount += 1;
    } else {
      byQuiz.set(q.id, {
        quizId: q.id,
        quizTitle: q.title,
        subjectName: q.subject?.name ?? null,
        subjectColor: q.subject?.color ?? null,
        missedCount: 1,
      });
    }
  }
  const reviewable = Array.from(byQuiz.values()).sort(
    (a, b) => b.missedCount - a.missedCount
  );

  return (
    <div className="space-y-5 md:space-y-6">
      <MakeQuizForm
        subjects={subjects.map((s) => ({ id: s.id, name: s.name }))}
      />
      <MistakesToReview initial={reviewable} />
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-3">
          Your quizzes
        </h2>
        <QuizList
          initial={quizzes.map((q) => ({
            id: q.id,
            title: q.title,
            createdAt: q.createdAt.toISOString(),
            questionCount: q._count.questions,
            subject: q.subject
              ? {
                  id: q.subject.id,
                  name: q.subject.name,
                  color: q.subject.color,
                }
              : null,
          }))}
        />
      </div>
    </div>
  );
}

async function FlashcardsTab({
  user,
  subjects,
}: {
  user: { id: string };
  subjects: { id: string; name: string; color: string }[];
}) {
  const decks = await prisma.flashcardDeck.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      subject: true,
      _count: { select: { cards: true } },
    },
  });

  return (
    <FlashcardDecksList
      initial={decks.map((d) => ({
        id: d.id,
        title: d.title,
        description: d.description,
        createdAt: d.createdAt.toISOString(),
        cardCount: d._count.cards,
        subject: d.subject
          ? { id: d.subject.id, name: d.subject.name, color: d.subject.color }
          : null,
      }))}
      subjects={subjects}
    />
  );
}
