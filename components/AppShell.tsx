"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import UserMenu from "./UserMenu";
import PageTransition from "./PageTransition";
import NotificationsClient from "./NotificationsClient";

export default function AppShell({
  children,
  userName,
  userEmail,
  streakDays,
  isActiveToday,
  freezesAvailable,
  freezeJustUsed,
}: {
  children: React.ReactNode;
  userName: string;
  userEmail: string;
  streakDays: number;
  isActiveToday: boolean;
  freezesAvailable: number;
  freezeJustUsed: boolean;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  // Close drawer whenever route changes (mobile UX expectation)
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Lock body scroll while drawer is open
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  return (
    <div className="min-h-screen md:flex">
      {/* Backdrop for mobile drawer */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm md:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar
        streakDays={streakDays}
        isActiveToday={isActiveToday}
        freezesAvailable={freezesAvailable}
        freezeJustUsed={freezeJustUsed}
        drawerOpen={drawerOpen}
        onCloseDrawer={() => setDrawerOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 md:h-16 px-4 md:px-8 flex items-center justify-between border-b border-slate-200/70 dark:border-slate-700/70 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="md:hidden -ml-1 h-10 w-10 inline-flex items-center justify-center rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-transform"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="18" x2="20" y2="18" />
              </svg>
            </button>
            <div className="text-sm md:text-base text-slate-500 dark:text-slate-400 truncate">
              <span className="hidden sm:inline">Welcome back, </span>
              <span className="text-slate-900 dark:text-slate-100 font-semibold">
                {userName}
              </span>
            </div>
          </div>
          <UserMenu name={userName} email={userEmail} />
        </header>
        <main className="flex-1 overflow-auto">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
      <NotificationsClient />
    </div>
  );
}
