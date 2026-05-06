import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { flashcardSchema } from "@/lib/validation";

async function ownsCard(userId: string, cardId: string) {
  const card = await prisma.flashcard.findUnique({
    where: { id: cardId },
    include: { deck: true },
  });
  return card && card.deck.userId === userId ? card : null;
}

export async function PATCH(
  request: Request,
  { params }: { params: { cardId: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const existing = await ownsCard(session.userId, params.cardId);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = flashcardSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const card = await prisma.flashcard.update({
    where: { id: params.cardId },
    data: parsed.data,
  });
  return NextResponse.json({ card });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { cardId: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const existing = await ownsCard(session.userId, params.cardId);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.flashcard.delete({ where: { id: params.cardId } });
  return NextResponse.json({ ok: true });
}
