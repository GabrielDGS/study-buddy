import { prisma } from "./db";

// Per-user daily limits. Reset at local midnight (server time).
export const QUOTAS = {
  messages: 50,
  quizzes: 3,
} as const;

function startOfTodayLocal(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getUsage(userId: string): Promise<{
  messagesUsed: number;
  messagesLimit: number;
  quizzesUsed: number;
  quizzesLimit: number;
  messagesRemaining: number;
  quizzesRemaining: number;
}> {
  const since = startOfTodayLocal();

  const [messagesUsed, quizzesUsed] = await Promise.all([
    prisma.chatMessage.count({
      where: { userId, role: "user", createdAt: { gte: since } },
    }),
    prisma.quiz.count({
      where: { userId, createdAt: { gte: since } },
    }),
  ]);

  return {
    messagesUsed,
    messagesLimit: QUOTAS.messages,
    quizzesUsed,
    quizzesLimit: QUOTAS.quizzes,
    messagesRemaining: Math.max(0, QUOTAS.messages - messagesUsed),
    quizzesRemaining: Math.max(0, QUOTAS.quizzes - quizzesUsed),
  };
}

export async function canSendMessage(userId: string): Promise<{
  allowed: boolean;
  reason?: string;
  used: number;
  limit: number;
}> {
  const used = await prisma.chatMessage.count({
    where: {
      userId,
      role: "user",
      createdAt: { gte: startOfTodayLocal() },
    },
  });
  const allowed = used < QUOTAS.messages;
  return {
    allowed,
    reason: allowed
      ? undefined
      : `You've used your daily limit of ${QUOTAS.messages} AI messages. The limit resets at midnight.`,
    used,
    limit: QUOTAS.messages,
  };
}

export async function canCreateQuiz(userId: string): Promise<{
  allowed: boolean;
  reason?: string;
  used: number;
  limit: number;
}> {
  const used = await prisma.quiz.count({
    where: {
      userId,
      createdAt: { gte: startOfTodayLocal() },
    },
  });
  const allowed = used < QUOTAS.quizzes;
  return {
    allowed,
    reason: allowed
      ? undefined
      : `You've reached your daily limit of ${QUOTAS.quizzes} new quizzes. The limit resets at midnight.`,
    used,
    limit: QUOTAS.quizzes,
  };
}
