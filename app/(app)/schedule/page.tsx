import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import ScheduleManager from "./ScheduleManager";
import CalendarSync from "./CalendarSync";

export default async function SchedulePage() {
  const user = (await getCurrentUser())!;
  const [items, subjects] = await Promise.all([
    prisma.scheduleItem.findMany({
      where: { userId: user.id },
      orderBy: { dueDate: "asc" },
      include: { subject: true },
    }),
    prisma.subject.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="mb-5 md:mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">
            📅 Schedule
          </h1>
          <p className="text-base md:text-lg text-slate-600 mt-1.5 md:mt-2">
            Tests, quizzes, assignments, and study sessions.
          </p>
        </div>
        <CalendarSync />
      </div>
      <ScheduleManager
        initialItems={items.map((i) => ({
          ...i,
          dueDate: i.dueDate.toISOString(),
          studyStart: i.studyStart ? i.studyStart.toISOString() : null,
        }))}
        subjects={subjects}
      />
    </div>
  );
}
