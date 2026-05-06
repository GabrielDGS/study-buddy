import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

/**
 * Returns the list of notifications the client should consider firing right now.
 * The client de-duplicates locally (per browser) using the `id` field — so the
 * same notification only fires once per device per day.
 *
 * IDs are stable for the day (e.g. "tomorrow:itemId:2026-05-06") so refreshing
 * doesn't re-fire them.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);
  const endOfTomorrow = new Date(endOfToday);
  endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);
  const todayKey = startOfToday.toISOString().slice(0, 10);

  const [user, dueToday, dueTomorrow] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { name: true, streakDays: true, lastActiveDate: true },
    }),
    prisma.scheduleItem.findMany({
      where: {
        userId: session.userId,
        status: { not: "done" },
        dueDate: { gte: startOfToday, lt: endOfToday },
      },
      include: { subject: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
    }),
    prisma.scheduleItem.findMany({
      where: {
        userId: session.userId,
        status: { not: "done" },
        dueDate: { gte: endOfToday, lt: endOfTomorrow },
      },
      include: { subject: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
    }),
  ]);

  type N = {
    id: string; // stable per day
    title: string;
    body: string;
    url: string;
    priority: "high" | "normal";
  };
  const notifications: N[] = [];

  // 1. Tomorrow's items — fire once during today as a heads-up
  for (const item of dueTomorrow) {
    if (item.type === "study") continue; // study sessions are self-set; less urgent
    const subj = item.subject?.name ? ` (${item.subject.name})` : "";
    const time = new Date(item.dueDate).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
    notifications.push({
      id: `tomorrow:${item.id}:${todayKey}`,
      title: `📌 Tomorrow: ${item.title}`,
      body: `${item.type[0].toUpperCase() + item.type.slice(1)}${subj} — due tomorrow at ${time}`,
      url: "/schedule",
      priority: "high",
    });
  }

  // 2. Today's items — single summary if any are pending
  if (dueToday.length > 0) {
    const titles = dueToday
      .slice(0, 3)
      .map((i) => i.title)
      .join(", ");
    const more =
      dueToday.length > 3 ? ` and ${dueToday.length - 3} more` : "";
    notifications.push({
      id: `today:${todayKey}`,
      title: `📅 ${dueToday.length} item${dueToday.length === 1 ? "" : "s"} due today`,
      body: `${titles}${more}`,
      url: "/dashboard",
      priority: "high",
    });
  }

  // 3. Streak-at-risk: streak > 0, last active wasn't today, and it's late enough
  //    to warrant a nudge (after 4pm local). Reset wakeup window each day.
  if (
    user &&
    user.streakDays > 0 &&
    user.lastActiveDate &&
    now.getHours() >= 16
  ) {
    const lastActive = new Date(user.lastActiveDate);
    const lastActiveDay = new Date(lastActive);
    lastActiveDay.setHours(0, 0, 0, 0);
    if (lastActiveDay.getTime() < startOfToday.getTime()) {
      notifications.push({
        id: `streak:${todayKey}`,
        title: `🔥 Don't break your ${user.streakDays}-day streak!`,
        body: `Open something today to keep it alive.`,
        url: "/dashboard",
        priority: "high",
      });
    }
  }

  return NextResponse.json({ notifications });
}
