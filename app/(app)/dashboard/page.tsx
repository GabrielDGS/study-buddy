import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { styleForType } from "@/lib/scheduleStyles";
import MissedSection from "./MissedSection";

function formatDate(d: Date) {
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function daysUntil(d: Date) {
  const now = new Date();
  const ms = d.getTime() - now.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export default async function DashboardPage() {
  const user = (await getCurrentUser())!;
  const now = new Date();
  const [subjects, upcoming, allItems, missed] = await Promise.all([
    prisma.subject.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    }),
    prisma.scheduleItem.findMany({
      where: {
        userId: user.id,
        status: { not: "done" },
        dueDate: { gte: new Date(Date.now() - 1000 * 60 * 60 * 12) },
      },
      orderBy: { dueDate: "asc" },
      take: 8,
      include: { subject: true },
    }),
    prisma.scheduleItem.findMany({
      where: { userId: user.id },
      select: { status: true, type: true },
    }),
    // Anything past-due and not yet marked done.
    prisma.scheduleItem.findMany({
      where: {
        userId: user.id,
        status: { not: "done" },
        dueDate: { lt: now },
      },
      orderBy: { dueDate: "desc" },
      include: { subject: true },
    }),
  ]);

  const totalItems = allItems.length;
  const doneItems = allItems.filter((i) => i.status === "done").length;
  const pendingItems = totalItems - doneItems;
  const completionPct =
    totalItems === 0 ? 0 : Math.round((doneItems / totalItems) * 100);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6 md:space-y-8">
      <section>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Hi, {user.name.split(" ")[0]}{" "}
          <span className="inline-block animate-pop-in">👋</span>
        </h1>
        <p className="text-base md:text-lg text-slate-600 mt-1.5 md:mt-2">
          Here&apos;s what&apos;s coming up. Let&apos;s stay ahead.
        </p>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon="📚"
          label="Subjects"
          value={subjects.length}
          gradient="from-indigo-500 to-blue-500"
        />
        <StatCard
          icon="🗓️"
          label="Upcoming"
          value={pendingItems}
          gradient="from-amber-500 to-orange-500"
        />
        <StatCard
          icon="✅"
          label="Completed"
          value={`${completionPct}%`}
          gradient="from-emerald-500 to-teal-500"
        />
      </section>

      {missed.length > 0 && (
        <MissedSection
          items={missed.map((m) => ({
            id: m.id,
            title: m.title,
            type: m.type,
            dueDate: m.dueDate.toISOString(),
            subject: m.subject
              ? { name: m.subject.name, color: m.subject.color }
              : null,
          }))}
        />
      )}

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-slate-900">
              Upcoming items
            </h2>
            <Link
              href="/schedule"
              className="text-sm text-brand-600 hover:underline lift inline-block"
            >
              View calendar →
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <div className="text-base text-slate-500 py-10 text-center">
              Nothing scheduled.{" "}
              <Link
                href="/schedule"
                className="text-brand-600 hover:underline font-medium"
              >
                Add a test or assignment
              </Link>
              .
            </div>
          ) : (
            <ul className="space-y-3">
              {upcoming.map((item) => {
                const days = daysUntil(new Date(item.dueDate));
                const ts = styleForType(item.type);
                return (
                  <li
                    key={item.id}
                    className="flex items-center gap-4 rounded-lg border border-slate-200/70 bg-white/60 p-4 transition-all hover:bg-white hover:border-brand-200 hover:shadow-sm"
                  >
                    <span
                      className="h-10 w-1.5 rounded-full"
                      style={{
                        backgroundColor: item.subject?.color ?? "#94a3b8",
                      }}
                      aria-hidden
                    />
                    <span
                      className="inline-flex items-center justify-center h-10 w-10 rounded-lg shrink-0"
                      style={{
                        backgroundColor: ts.chipBg,
                        border: `1px solid ${ts.chipBorder}`,
                      }}
                      aria-hidden
                    >
                      <span className="text-xl">{ts.icon}</span>
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 truncate">
                        {item.title}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span
                          className="inline-flex items-center text-[11px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5"
                          style={{
                            backgroundColor: ts.chipBg,
                            color: ts.chipText,
                            border: `1px solid ${ts.chipBorder}`,
                          }}
                        >
                          {ts.label}
                        </span>
                        <span className="text-sm text-slate-500 truncate">
                          {item.subject?.name ?? "No subject"}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-medium text-slate-900">
                        {formatDate(new Date(item.dueDate))}
                      </div>
                      <div
                        className={`text-xs font-medium ${
                          days < 0
                            ? "text-red-600"
                            : days <= 2
                              ? "text-amber-600"
                              : "text-slate-500"
                        }`}
                      >
                        {days < 0
                          ? `${-days}d overdue`
                          : days === 0
                            ? "Today"
                            : days === 1
                              ? "Tomorrow"
                              : `in ${days}d`}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-slate-900">Subjects</h2>
            <Link
              href="/subjects"
              className="text-sm text-brand-600 hover:underline lift inline-block"
            >
              Manage
            </Link>
          </div>
          {subjects.length === 0 ? (
            <div className="text-sm text-slate-500">No subjects yet.</div>
          ) : (
            <ul className="space-y-2">
              {subjects.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center gap-3 rounded-lg border border-slate-200/70 bg-white/60 p-3 transition-all hover:bg-white hover:border-brand-200"
                >
                  <span
                    className="h-4 w-4 rounded-full shrink-0"
                    style={{ backgroundColor: s.color }}
                    aria-hidden
                  />
                  <span className="text-sm font-medium text-slate-900 truncate">
                    {s.name}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="card p-7 bg-gradient-to-br from-brand-50/80 via-purple-50/60 to-pink-50/60">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="flex-1 min-w-[260px]">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-3xl" aria-hidden>
                🤖
              </span>
              <h2 className="text-xl font-bold text-slate-900">
                Need help studying?
              </h2>
            </div>
            <p className="text-base text-slate-700 max-w-xl">
              Ask your AI study buddy to schedule study sessions, break down
              tough material, or generate a practice quiz from your notes or
              outside sources.
            </p>
          </div>
          <Link href="/chat" className="btn-primary shrink-0 text-base">
            Open AI Helper →
          </Link>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  gradient,
}: {
  icon: string;
  label: string;
  value: string | number;
  gradient: string;
}) {
  return (
    <div className="card p-5 flex items-center gap-4 transition-all hover:shadow-md hover:scale-[1.02]">
      <div
        className={`h-12 w-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-2xl shadow-md`}
      >
        <span aria-hidden>{icon}</span>
      </div>
      <div>
        <div className="text-sm text-slate-500 font-medium">{label}</div>
        <div className="text-2xl font-bold text-slate-900">{value}</div>
      </div>
    </div>
  );
}
