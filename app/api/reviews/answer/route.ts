import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { recordReviewAnswer } from "@/lib/spacedRepetition";

const schema = z.object({
  questionId: z.string().min(1),
  correct: z.boolean(),
});

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

  const question = await prisma.question.findUnique({
    where: { id: parsed.data.questionId },
    include: { quiz: true },
  });
  if (!question || question.quiz.userId !== session.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await recordReviewAnswer({
    userId: session.userId,
    questionId: parsed.data.questionId,
    correct: parsed.data.correct,
  });
  return NextResponse.json({ ok: true });
}
