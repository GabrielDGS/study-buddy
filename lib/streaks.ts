// Daily-streak tracking. A user "checks in" any time they take meaningful
// action in the app (open the dashboard, mark an item done, send a chat,
// finish a quiz, finish a review). Multiple check-ins on the same day are
// idempotent.

import { prisma } from "./db";

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysBetween(a: Date, b: Date): number {
  const ms = startOfDay(b).getTime() - startOfDay(a).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export type StreakInfo = {
  streakDays: number;
  isActiveToday: boolean;
  /** True if today's check-in just incremented the streak. */
  justIncremented: boolean;
};

/**
 * Idempotently record activity for the given user.
 * Returns the new streak info.
 */
export async function recordActivity(userId: string): Promise<StreakInfo> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { streakDays: true, lastActiveDate: true },
  });
  if (!user) {
    return { streakDays: 0, isActiveToday: false, justIncremented: false };
  }

  const now = new Date();
  const today = startOfDay(now);

  if (user.lastActiveDate) {
    const last = startOfDay(user.lastActiveDate);
    const diff = daysBetween(last, today);
    if (diff === 0) {
      // Already checked in today — nothing to do.
      return {
        streakDays: user.streakDays,
        isActiveToday: true,
        justIncremented: false,
      };
    }

    if (diff === 1) {
      // Consecutive day — increment.
      const next = user.streakDays + 1;
      await prisma.user.update({
        where: { id: userId },
        data: { streakDays: next, lastActiveDate: now },
      });
      return { streakDays: next, isActiveToday: true, justIncremented: true };
    }
    // Gap of 2+ days — streak resets to 1.
    await prisma.user.update({
      where: { id: userId },
      data: { streakDays: 1, lastActiveDate: now },
    });
    return { streakDays: 1, isActiveToday: true, justIncremented: true };
  }

  // First-ever activity
  await prisma.user.update({
    where: { id: userId },
    data: { streakDays: 1, lastActiveDate: now },
  });
  return { streakDays: 1, isActiveToday: true, justIncremented: true };
}

/** Read-only streak status; does not record activity. */
export async function getStreak(userId: string): Promise<StreakInfo> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { streakDays: true, lastActiveDate: true },
  });
  if (!user || !user.lastActiveDate) {
    return { streakDays: 0, isActiveToday: false, justIncremented: false };
  }
  const today = startOfDay(new Date());
  const last = startOfDay(user.lastActiveDate);
  const diff = daysBetween(last, today);

  // If they haven't been active in 2+ days, the streak is technically broken
  // (we'll reset it on next activity). Show what's effectively in the DB.
  return {
    streakDays: user.streakDays,
    isActiveToday: diff === 0,
    justIncremented: false,
  };
}
