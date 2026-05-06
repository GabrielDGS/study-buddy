import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { generateFlashcardDeck } from "@/lib/ai";

const schema = z.object({
  topic: z.string().trim().min(3, "Be a bit more specific about the topic").max(500),
  subjectId: z.string().optional().nullable(),
  count: z.number().int().min(4).max(30).default(12),
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
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const result = await generateFlashcardDeck({
    userId: session.userId,
    topic: parsed.data.topic,
    subjectId: parsed.data.subjectId ?? null,
    count: parsed.data.count,
  });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result);
}
