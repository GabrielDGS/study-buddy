import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { generateSpecificQuiz } from "@/lib/ai";

const schema = z.object({
  topic: z
    .string()
    .trim()
    .min(5, "Be specific — a one-word topic won't make a good quiz")
    .max(200),
  subtopics: z.string().trim().max(2000).default(""),
  subjectId: z.string().optional().nullable(),
  difficulty: z.enum(["easy", "medium", "hard", "mixed"]).default("mixed"),
  count: z.number().int().min(4).max(15).default(10),
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

  const result = await generateSpecificQuiz({
    userId: session.userId,
    topic: parsed.data.topic,
    subtopics: parsed.data.subtopics,
    subjectId: parsed.data.subjectId ?? null,
    difficulty: parsed.data.difficulty,
    count: parsed.data.count,
  });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result);
}
