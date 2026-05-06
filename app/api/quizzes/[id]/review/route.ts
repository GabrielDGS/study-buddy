import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { generateReviewQuizFromMissed } from "@/lib/ai";

const schema = z.object({
  missedQuestionIds: z.array(z.string()).optional(),
});

/**
 * Generate a review quiz from the user's mistakes on a given source quiz.
 *
 * If `missedQuestionIds` is provided (typically from the QuizRunner completion
 * screen), use that list. Otherwise, find pending QuestionReview rows for
 * questions in the source quiz.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    /* allow empty body */
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // Verify ownership
  const sourceQuiz = await prisma.quiz.findUnique({
    where: { id: params.id },
  });
  if (!sourceQuiz || sourceQuiz.userId !== session.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let questionIds = parsed.data.missedQuestionIds ?? [];

  // Fall back to the SR queue if no explicit list was provided.
  if (questionIds.length === 0) {
    const reviews = await prisma.questionReview.findMany({
      where: {
        userId: session.userId,
        question: { quizId: params.id },
      },
      select: { questionId: true },
    });
    questionIds = reviews.map((r) => r.questionId);
  }

  if (questionIds.length === 0) {
    return NextResponse.json(
      { error: "No missed questions to review yet." },
      { status: 400 }
    );
  }

  const result = await generateReviewQuizFromMissed({
    userId: session.userId,
    sourceQuizId: params.id,
    questionIds,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result);
}
