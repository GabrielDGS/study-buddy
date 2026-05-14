import { redirect } from "next/navigation";
import { getCurrentUser, getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { recordActivity } from "@/lib/streaks";
import AppShell from "@/components/AppShell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    // If there's a stale session cookie (valid JWT but the user no longer
    // exists — e.g. after a DB reset), bounce through logout to clear it.
    // Otherwise middleware will keep sending us back here in a loop.
    const stillHasSession = await getSession();
    redirect(stillHasSession ? "/api/auth/logout?next=/login" : "/login");
  }

  const subjectCount = await prisma.subject.count({
    where: { userId: user.id },
  });
  if (subjectCount === 0) redirect("/onboarding");

  const streak = await recordActivity(user.id);

  return (
    <AppShell
      userName={user.name}
      userEmail={user.email}
      streakDays={streak.streakDays}
      isActiveToday={streak.isActiveToday}
      freezesAvailable={streak.freezesAvailable}
      freezeJustUsed={streak.freezeJustUsed}
    >
      {children}
    </AppShell>
  );
}
