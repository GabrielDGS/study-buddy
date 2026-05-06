import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { scheduleItemSchema } from "@/lib/validation";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await prisma.scheduleItem.findMany({
    where: { userId: session.userId },
    orderBy: { dueDate: "asc" },
    include: { subject: true },
  });
  return NextResponse.json({ items });
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
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

  const parsed = scheduleItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const dueDate = parseDate(parsed.data.dueDate);
  if (!dueDate) {
    return NextResponse.json({ error: "Invalid due date" }, { status: 400 });
  }
  const studyStart = parsed.data.studyStart
    ? parseDate(parsed.data.studyStart)
    : null;

  // Verify subject ownership if provided
  if (parsed.data.subjectId) {
    const subject = await prisma.subject.findUnique({
      where: { id: parsed.data.subjectId },
    });
    if (!subject || subject.userId !== session.userId) {
      return NextResponse.json({ error: "Invalid subject" }, { status: 400 });
    }
  }

  const item = await prisma.scheduleItem.create({
    data: {
      userId: session.userId,
      subjectId: parsed.data.subjectId || null,
      title: parsed.data.title,
      type: parsed.data.type,
      dueDate,
      studyStart,
      estMinutes: parsed.data.estMinutes ?? null,
      status: parsed.data.status,
      notes: parsed.data.notes ?? null,
    },
    include: { subject: true },
  });
  return NextResponse.json({ item });
}
