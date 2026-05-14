// Daily-streak tracking with auto-applied "streak freezes."
//
// A streak freeze is a banked one-day grace token that protects the streak
// when the user misses a day. Users start with 2 freezes; they earn one
// additional freeze for every 7 consecutive active days, up to a max of 5.
// Freezes are consumed automatically when the user comes back after exactly
// one missed day. After two consecutive misses, the streak resets even if
// freezes are available (because a two-day gap is a real lapse).

import { prisma } from "./db";

const MAX_FREEZES = 5;

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
  justIncremented: boolean;
  /** Number of freezes the user currently has banked. */
  freezesAvailable: number;
  /** Set if a freeze was just consumed to keep this streak alive. */
  freezeJustUsed: boolean;
};

/**
 * Idempotently record activity for the given user.
 * Consumes a streak-freeze automatically if the user skipped exactly one day.
 */
export async function recordActivity(userId: string): Promise<StreakInfo> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      streakDays: true,
      lastActiveDate: true,
      streakFreezes: true,
    },
  });
  if (!user) {
    return {
      streakDays: 0,
      isActiveToday: false,
      justIncremented: false,
      freezesAvailable: 0,
      freezeJustUsed: false,
    };
  }

  const now = new Date();
  const today = startOfDay(now);

  if (!user.lastActiveDate) {
    // First ever activity
    await prisma.user.update({
      where: { id: userId },
      data: { streakDays: 1, lastActiveDate: now },
    });
    return {
      streakDays: 1,
      isActiveToday: true,
      justIncremented: true,
      freezesAvailable: user.streakFreezes,
      freezeJustUsed: false,
    };
  }

  const last = startOfDay(user.lastActiveDate);
  const diff = daysBetween(last, today);

  // Same day — no-op.
  if (diff === 0) {
    return {
      streakDays: user.streakDays,
      isActiveToday: true,
      justIncremented: false,
      freezesAvailable: user.streakFreezes,
      freezeJustUsed: false,
    };
  }

  // Consecutive day — bump streak. Earn a freeze every 7 days, capped.
  if (diff === 1) {
    const nextStreak = user.streakDays + 1;
    const earnedFreeze =
      nextStreak % 7 === 0 && user.streakFreezes < MAX_FREEZES;
    const nextFreezes = earnedFreeze
      ? user.streakFreezes + 1
      : user.streakFreezes;
    await prisma.user.update({
      where: { id: userId },
      data: {
        streakDays: nextStreak,
        lastActiveDate: now,
        streakFreezes: nextFreezes,
      },
    });
    return {
      streakDays: nextStreak,
      isActiveToday: true,
      justIncremented: true,
      freezesAvailable: nextFreezes,
      freezeJustUsed: false,
    };
  }

  // Exactly one missed day — try to use a freeze.
  if (diff === 2 && user.streakFreezes > 0) {
    const nextStreak = user.streakDays + 1;
    await prisma.user.update({
      where: { id: userId },
      data: {
        streakDays: nextStreak,
        lastActiveDate: now,
        streakFreezes: user.streakFreezes - 1,
        lastFreezeUsed: now,
      },
    });
    return {
      streakDays: nextStreak,
      isActiveToday: true,
      justIncremented: true,
      freezesAvailable: user.streakFreezes - 1,
      freezeJustUsed: true,
    };
  }

  // Gap is too big OR no freezes left — reset to 1.
  await prisma.user.update({
    where: { id: userId },
    data: { streakDays: 1, lastActiveDate: now },
  });
  return {
    streakDays: 1,
    isActiveToday: true,
    justIncremented: true,
    freezesAvailable: user.streakFreezes,
    freezeJustUsed: false,
  };
}

export async function getStreak(userId: string): Promise<StreakInfo> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      streakDays: true,
      lastActiveDate: true,
      streakFreezes: true,
    },
  });
  if (!user || !user.lastActiveDate) {
    return {
      streakDays: 0,
      isActiveToday: false,
      justIncremented: false,
      freezesAvailable: user?.streakFreezes ?? 0,
      freezeJustUsed: false,
    };
  }
  const today = startOfDay(new Date());
  const last = startOfDay(user.lastActiveDate);
  const diff = daysBetween(last, today);
  return {
    streakDays: user.streakDays,
    isActiveToday: diff === 0,
    justIncremented: false,
    freezesAvailable: user.streakFreezes,
    freezeJustUsed: false,
  };
}
