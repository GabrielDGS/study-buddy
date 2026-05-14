"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/today", label: "Today", icon: "🎯" },
  { href: "/dashboard", label: "Dashboard", icon: "🏠" },
  { href: "/schedule", label: "Schedule", icon: "📅" },
  { href: "/subjects", label: "Subjects", icon: "📚" },
  { href: "/quizzes", label: "Practice", icon: "📝" },
  { href: "/chat", label: "AI Helper", icon: "🤖" },
];

export default function Sidebar({
  streakDays,
  isActiveToday,
  freezesAvailable,
  freezeJustUsed,
  drawerOpen,
  onCloseDrawer,
}: {
  streakDays: number;
  isActiveToday: boolean;
  freezesAvailable: number;
  freezeJustUsed: boolean;
  drawerOpen: boolean;
  onCloseDrawer: () => void;
}) {
  const pathname = usePathname();

  // Mobile: fixed, slides in from left when drawerOpen.
  // Desktop (md+): static, always visible.
  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 w-72 max-w-[85vw] shrink-0
        border-r border-slate-200/70 dark:border-slate-700/70 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md
        flex flex-col shadow-2xl
        transform transition-transform duration-200 ease-out
        ${drawerOpen ? "translate-x-0" : "-translate-x-full"}
        md:relative md:w-64 md:translate-x-0 md:shadow-none md:bg-white/60 md:dark:bg-slate-900/60`}
    >
      <div className="h-14 md:h-16 px-5 flex items-center justify-between border-b border-slate-200/70 dark:border-slate-700/70">
        <Link
          href="/today"
          className="font-bold text-xl bg-gradient-to-br from-brand-600 to-pink-500 bg-clip-text text-transparent lift"
        >
          Study Buddy
        </Link>
        <button
          className="md:hidden h-9 w-9 inline-flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-transform"
          onClick={onCloseDrawer}
          aria-label="Close menu"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>
      </div>

      {streakDays > 0 && (
        <div className="px-3 pt-3">
          <div
            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium border transition-all ${
              freezeJustUsed
                ? "bg-gradient-to-br from-sky-50 to-cyan-50 border-sky-200 text-sky-900 dark:from-sky-900/30 dark:to-cyan-900/30 dark:border-sky-700 dark:text-sky-100"
                : isActiveToday
                  ? "bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200 text-orange-900 dark:from-orange-900/30 dark:to-amber-900/30 dark:border-orange-700 dark:text-orange-100"
                  : "bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
            }`}
            title={
              freezeJustUsed
                ? `Freeze saved your streak! ${freezesAvailable} left.`
                : isActiveToday
                  ? `${streakDays}-day streak — keep going!`
                  : `Last streak: ${streakDays} days. Open something today to keep it alive.`
            }
          >
            <span className="text-xl" aria-hidden>
              {freezeJustUsed ? "🧊" : isActiveToday ? "🔥" : "💤"}
            </span>
            <div className="flex-1 leading-tight">
              <div className="font-bold">
                {streakDays} day{streakDays === 1 ? "" : "s"}
              </div>
              <div className="text-[10px] uppercase tracking-wide opacity-80">
                {freezeJustUsed
                  ? "Freeze used"
                  : isActiveToday
                    ? "Streak alive!"
                    : "Keep your streak"}
              </div>
            </div>
            {freezesAvailable > 0 && (
              <div
                className="flex items-center gap-0.5 text-xs opacity-80"
                title={`${freezesAvailable} streak freeze${freezesAvailable === 1 ? "" : "s"} banked`}
              >
                <span aria-hidden>🧊</span>
                <span>{freezesAvailable}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
        {NAV.map((item) => {
          const active =
            pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={active ? "nav-link-active" : "nav-link-idle"}
              onClick={onCloseDrawer}
            >
              <span className="text-base" aria-hidden>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="p-3 text-xs text-slate-400 dark:text-slate-500 border-t border-slate-200/60 dark:border-slate-700/60">
        Stay one step ahead 📈
      </div>
    </aside>
  );
}
