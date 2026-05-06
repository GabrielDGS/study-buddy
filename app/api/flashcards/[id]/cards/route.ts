import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { flashcardSchema } from "@/lib/validation";

async function ownsDeck(userId: string, deckId: string) {
  const deck = await prisma.flashcardDeck.findUnique({ where: { id: deckId } });
  return deck && deck.userId === userId ? deck : null;
}

/** Add a single card to a deck. */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const deck = await ownsDeck(session.userId, params.id);
  if (!deck) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = flashcardSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const lastIndex = await prisma.flashcard.findFirst({
    where: { deckId: deck.id },
    orderBy: { orderIndex: "desc" },
    select: { orderIndex: true },
  });

  const card = await prisma.flashcard.create({
    data: {
      deckId: deck.id,
      front: parsed.data.front,
      back: parsed.data.back,
      hint: parsed.data.hint ?? null,
      orderIndex: (lastIndex?.orderIndex ?? -1) + 1,
    },
  });
  return NextResponse.json({ card });
}
