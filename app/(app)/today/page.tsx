import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { styleForType } from "@/lib/scheduleStyles";
import TodayView from "./TodayView";

function daysUntil(d: Date) {
  const ms = d.getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export default async function TodayPage() {
  const user = (await getCurrentUser())!;
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + 14);

  const [dueToday, missed, upcoming] = await Promise.all([
    prisma.scheduleItem.findMany({
      where: {
        userId: user.id,
        status: { not: "done" },
        dueDate: { gte: startOfToday, lt: endOfToday },
      },
      orderBy: { dueDate: "asc" },
      include: { subject: true },
    }),
    prisma.scheduleItem.findMany({
      where: {
        userId: user.id,
        status: { not: "done" },
        dueDate: { lt: now },
      },
      orderBy: { dueDate: "desc" },
      take: 5,
      include: { subject: true },
    }),
    prisma.scheduleItem.findMany({
      where: {
        userId: user.id,
        status: { not: "done" },
        dueDate: { gte: endOfToday, lt: horizon },
      },
      orderBy: { dueDate: "asc" },
      take: 5,
      include: { subject: true },
    }),
  ]);

  function shape(item: (typeof dueToday)[number]) {
    const ts = styleForType(item.type);
    return {
      id: item.id,
      title: item.title,
      type: item.type,
      typeLabel: ts.label,
      typeIcon: ts.icon,
      typeColor: ts.solid,
      typeBg: ts.chipBg,
      typeText: ts.chipText,
      subject: item.subject
        ? { name: item.subject.name, color: item.subject.color }
        : null,
      dueDate: item.dueDate.toISOString(),
      estMinutes: item.estMinutes,
      notes: item.notes,
      daysUntil: daysUntil(item.dueDate),
    };
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="mb-5 md:mb-6">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          🎯 Today
        </h1>
        <p className="text-base md:text-lg text-slate-600 dark:text-slate-400 mt-1.5 md:mt-2">
          {now.toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
          {" · "}what to focus on right now.
        </p>
      </div>

      <TodayView
        dueToday={dueToday.map(shape)}
        missed={missed.map(shape)}
        upcoming={upcoming.map(shape)}
      />

      {dueToday.length === 0 &&
        missed.length === 0 &&
        upcoming.length === 0 && (
          <div className="card p-8 text-center mt-6">
            <div className="text-5xl mb-3">🌱</div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
              Nothing scheduled
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mt-2 max-w-md mx-auto">
              Add a test, quiz, or assignment to get started.
            </p>
            <Link href="/schedule" className="btn-primary mt-4 inline-flex">
              Go to Schedule
            </Link>
          </div>
        )}
    </div>
  );
}
