import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const quizzes = await prisma.quiz.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    include: {
      subject: true,
      _count: { select: { questions: true } },
    },
  });
  return NextResponse.json({ quizzes });
}
