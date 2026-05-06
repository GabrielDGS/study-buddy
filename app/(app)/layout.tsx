import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { recordActivity } from "@/lib/streaks";
import AppShell from "@/components/AppShell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

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
    >
      {children}
    </AppShell>
  );
}
