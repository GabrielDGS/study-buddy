import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import DeckRunner from "./DeckRunner";

export default async function DeckPage({
  params,
}: {
  params: { id: string };
}) {
  const user = (await getCurrentUser())!;
  const deck = await prisma.flashcardDeck.findUnique({
    where: { id: params.id },
    include: {
      subject: true,
      cards: { orderBy: { orderIndex: "asc" } },
    },
  });

  if (!deck || deck.userId !== user.id) notFound();

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <Link
        href="/quizzes?tab=flashcards"
        className="text-sm text-brand-600 hover:underline"
      >
        ← All decks
      </Link>
      <div className="mt-3 mb-5 md:mb-6">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
          {deck.title}
        </h1>
        <p className="text-slate-600 mt-1 text-sm">
          {deck.subject?.name ?? "No subject"} · {deck.cards.length} card
          {deck.cards.length === 1 ? "" : "s"}
          {deck.description ? ` · ${deck.description}` : ""}
        </p>
      </div>

      <DeckRunner
        deckId={deck.id}
        cards={deck.cards.map((c) => ({
          id: c.id,
          front: c.front,
          back: c.back,
          hint: c.hint,
        }))}
      />
    </div>
  );
}
