import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { scheduleItemSchema } from "@/lib/validation";

async function ownsItem(userId: string, itemId: string) {
  const item = await prisma.scheduleItem.findUnique({ where: { id: itemId } });
  return item && item.userId === userId ? item : null;
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await ownsItem(session.userId, params.id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = scheduleItemSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const data: Record<string, unknown> = { ...parsed.data };
  if ("dueDate" in parsed.data && parsed.data.dueDate !== undefined) {
    const d = parseDate(parsed.data.dueDate);
    if (!d) {
      return NextResponse.json({ error: "Invalid due date" }, { status: 400 });
    }
    data.dueDate = d;
  }
  if ("studyStart" in parsed.data) {
    data.studyStart = parsed.data.studyStart
      ? parseDate(parsed.data.studyStart)
      : null;
  }
  if (parsed.data.subjectId) {
    const subject = await prisma.subject.findUnique({
      where: { id: parsed.data.subjectId },
    });
    if (!subject || subject.userId !== session.userId) {
      return NextResponse.json({ error: "Invalid subject" }, { status: 400 });
    }
  }

  const item = await prisma.scheduleItem.update({
    where: { id: params.id },
    data,
    include: { subject: true },
  });
  return NextResponse.json({ item });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await ownsItem(session.userId, params.id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.scheduleItem.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
