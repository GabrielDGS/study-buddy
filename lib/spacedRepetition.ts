// Spaced-repetition scheduler.
//
// Levels and intervals (in days from now):
//   level 0  -> 1 day  (just missed)
//   level 1  -> 3 days
//   level 2  -> 7 days
//   level 3  -> 14 days
//   level 4  -> 30 days
//   level 5+ -> graduated; no further reviews scheduled
//
// On a wrong review answer, level resets to 0 (1 day from now).
// On a right review answer, level += 1 (longer interval).

import { prisma } from "./db";

const INTERVAL_DAYS = [1, 3, 7, 14, 30];
export const GRADUATED_LEVEL = INTERVAL_DAYS.length;

function dateAddDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

function nextDateForLevel(level: number): Date {
  const safeLevel = Math.max(0, Math.min(level, INTERVAL_DAYS.length - 1));
  return dateAddDays(new Date(), INTERVAL_DAYS[safeLevel]);
}

/** Mark a question as missed (or auto-revealed) — schedule it for tomorrow. */
export async function scheduleMissedQuestion(
  userId: string,
  questionId: string
) {
  const existing = await prisma.questionReview.findUnique({
    where: { userId_questionId: { userId, questionId } },
  });

  // Reset to level 0 (review tomorrow), bump attempt count.
  if (existing) {
    await prisma.questionReview.update({
      where: { id: existing.id },
      data: {
        level: 0,
        nextReviewAt: nextDateForLevel(0),
        totalAttempts: existing.totalAttempts + 1,
      },
    });
  } else {
    await prisma.questionReview.create({
      data: {
        userId,
        questionId,
        level: 0,
        nextReviewAt: nextDateForLevel(0),
        totalAttempts: 1,
      },
    });
  }
}

/** Record the result of a review-mode answer. */
export async function recordReviewAnswer(opts: {
  userId: string;
  questionId: string;
  correct: boolean;
}) {
  const { userId, questionId, correct } = opts;
  const existing = await prisma.questionReview.findUnique({
    where: { userId_questionId: { userId, questionId } },
  });

  if (correct) {
    if (!existing) return; // nothing to update
    const newLevel = existing.level + 1;
    if (newLevel >= GRADUATED_LEVEL) {
      // Graduated — push the next review far into the future so it stops appearing.
      await prisma.questionReview.update({
        where: { id: existing.id },
        data: {
          level: newLevel,
          nextReviewAt: dateAddDays(new Date(), 365 * 10),
          lastReviewedAt: new Date(),
          totalAttempts: existing.totalAttempts + 1,
          totalCorrect: existing.totalCorrect + 1,
        },
      });
    } else {
      await prisma.questionReview.update({
        where: { id: existing.id },
        data: {
          level: newLevel,
          nextReviewAt: nextDateForLevel(newLevel),
          lastReviewedAt: new Date(),
          totalAttempts: existing.totalAttempts + 1,
          totalCorrect: existing.totalCorrect + 1,
        },
      });
    }
    return;
  }

  // Wrong: reset to level 0
  if (existing) {
    await prisma.questionReview.update({
      where: { id: existing.id },
      data: {
        level: 0,
        nextReviewAt: nextDateForLevel(0),
        lastReviewedAt: new Date(),
        totalAttempts: existing.totalAttempts + 1,
      },
    });
  } else {
    await prisma.questionReview.create({
      data: {
        userId,
        questionId,
        level: 0,
        nextReviewAt: nextDateForLevel(0),
        lastReviewedAt: new Date(),
        totalAttempts: 1,
      },
    });
  }
}

export type DueReviewQuestion = {
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
  quiz: {
    id: string;
    title: string;
  };
};

export async function getDueReviews(
  userId: string
): Promise<DueReviewQuestion[]> {
  const now = new Date();
  const reviews = await prisma.questionReview.findMany({
    where: {
      userId,
      nextReviewAt: { lte: now },
      level: { lt: GRADUATED_LEVEL },
    },
    orderBy: { nextReviewAt: "asc" },
    include: {
      question: { include: { quiz: { select: { id: true, title: true } } } },
    },
  });

  return reviews.map((r) => ({
    reviewId: r.id,
    level: r.level,
    nextReviewAt: r.nextReviewAt.toISOString(),
    question: {
      id: r.question.id,
      prompt: r.question.prompt,
      type: r.question.type,
      imageUrl: r.question.imageUrl,
      options: r.question.optionsJson
        ? (JSON.parse(r.question.optionsJson) as string[])
        : [],
      correctAnswer: r.question.correctAnswer,
      explanation: r.question.explanation,
    },
    quiz: { id: r.question.quiz.id, title: r.question.quiz.title },
  }));
}

export async function getReviewCounts(userId: string): Promise<{
  due: number;
  upcoming: number;
}> {
  const now = new Date();
  const [due, upcoming] = await Promise.all([
    prisma.questionReview.count({
      where: {
        userId,
        nextReviewAt: { lte: now },
        level: { lt: GRADUATED_LEVEL },
      },
    }),
    prisma.questionReview.count({
      where: {
        userId,
        nextReviewAt: { gt: now },
        level: { lt: GRADUATED_LEVEL },
      },
    }),
  ]);
  return { due, upcoming };
}
