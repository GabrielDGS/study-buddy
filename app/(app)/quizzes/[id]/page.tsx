import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import QuizRunner from "./QuizRunner";
import DeleteQuizButton from "./DeleteQuizButton";

export default async function QuizPage({
  params,
}: {
  params: { id: string };
}) {
  const user = (await getCurrentUser())!;
  const quiz = await prisma.quiz.findUnique({
    where: { id: params.id },
    include: {
      subject: true,
      questions: { orderBy: { orderIndex: "asc" } },
    },
  });

  if (!quiz || quiz.userId !== user.id) notFound();

  const questions = quiz.questions.map((q) => ({
    id: q.id,
    prompt: q.prompt,
    type: q.type,
    imageUrl: q.imageUrl,
    options: q.optionsJson ? (JSON.parse(q.optionsJson) as string[]) : [],
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
  }));

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <Link href="/quizzes" className="text-sm text-brand-600 hover:underline">
          ← All quizzes
        </Link>
        <DeleteQuizButton quizId={quiz.id} quizTitle={quiz.title} />
      </div>
      <div className="mb-5 md:mb-6">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
          {quiz.title}
        </h1>
        <p className="text-slate-600 mt-1 text-sm">
          {quiz.subject?.name ?? "No subject"} · {questions.length} question
          {questions.length === 1 ? "" : "s"}
        </p>
      </div>
      <QuizRunner quizId={quiz.id} questions={questions} />
    </div>
  );
}
