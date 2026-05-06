import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { flashcardDeckSchema } from "@/lib/validation";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const decks = await prisma.flashcardDeck.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    include: {
      subject: true,
      _count: { select: { cards: true } },
    },
  });
  return NextResponse.json({ decks });
}

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
  const parsed = flashcardDeckSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  // Verify subject ownership if provided
  if (parsed.data.subjectId) {
    const subject = await prisma.subject.findUnique({
      where: { id: parsed.data.subjectId },
    });
    if (!subject || subject.userId !== session.userId) {
      return NextResponse.json({ error: "Invalid subject" }, { status: 400 });
    }
  }

  const deck = await prisma.flashcardDeck.create({
    data: {
      userId: session.userId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      subjectId: parsed.data.subjectId ?? null,
    },
  });
  return NextResponse.json({ deck });
}
