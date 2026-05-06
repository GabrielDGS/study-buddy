import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { scheduleMissedQuestion } from "@/lib/spacedRepetition";

const schema = z.object({
  questionIds: z.array(z.string().min(1)).min(1).max(50),
});

/**
 * Mark a batch of questions as missed → schedule them in the
 * spaced-repetition queue. The student's quiz runner calls this on
 * completion with every question they didn't get on the first try.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // Only schedule questions that belong to the user's own quizzes.
  const owned = await prisma.question.findMany({
    where: {
      id: { in: parsed.data.questionIds },
      quiz: { userId: session.userId },
    },
    select: { id: true },
  });
  for (const q of owned) {
    await scheduleMissedQuestion(session.userId, q.id);
  }

  return NextResponse.json({ ok: true, scheduled: owned.length });
}
