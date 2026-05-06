import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildIcsFeed } from "@/lib/icalendar";

/**
 * Public ICS feed endpoint. Authentication is via the per-user `calendarToken`
 * embedded in the URL — anyone with the token can read the events. The token
 * can be rotated by the user from the schedule page, which invalidates the
 * old subscription URL.
 */
export async function GET(
  _request: Request,
  { params }: { params: { token: string } }
) {
  // Allow URLs like /api/calendar/<token>.ics — strip suffix.
  const tokenRaw = params.token.replace(/\.ics$/i, "");

  const user = await prisma.user.findUnique({
    where: { calendarToken: tokenRaw },
    select: { id: true, name: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Invalid calendar token" }, { status: 404 });
  }

  const items = await prisma.scheduleItem.findMany({
    where: { userId: user.id },
    include: { subject: { select: { name: true } } },
    orderBy: { dueDate: "asc" },
  });

  const ics = buildIcsFeed({
    calendarName: `${user.name}'s Study Buddy`,
    calendarDescription: "Tests, quizzes, assignments, and study sessions.",
    items: items.map((i) => ({
      id: i.id,
      title: i.title,
      type: i.type,
      dueDate: i.dueDate,
      estMinutes: i.estMinutes,
      notes: i.notes,
      status: i.status,
      subjectName: i.subject?.name ?? null,
      updatedAt: i.updatedAt,
    })),
  });

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="study-buddy.ics"',
      "Cache-Control": "public, max-age=300",
    },
  });
}
