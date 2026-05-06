import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { flashcardDeckSchema } from "@/lib/validation";

async function ownsDeck(userId: string, deckId: string) {
  const deck = await prisma.flashcardDeck.findUnique({ where: { id: deckId } });
  return deck && deck.userId === userId ? deck : null;
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const existing = await ownsDeck(session.userId, params.id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = flashcardDeckSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const deck = await prisma.flashcardDeck.update({
    where: { id: params.id },
    data: parsed.data,
  });
  return NextResponse.json({ deck });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const existing = await ownsDeck(session.userId, params.id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.flashcardDeck.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
