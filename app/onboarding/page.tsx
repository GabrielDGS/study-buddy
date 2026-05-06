import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import OnboardingFlow from "./OnboardingFlow";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const subjectCount = await prisma.subject.count({
    where: { userId: user.id },
  });
  if (subjectCount > 0) redirect("/dashboard");

  return (
    <main className="min-h-screen px-4 py-10 grid place-items-center">
      <div className="w-full max-w-xl">
        <h1 className="text-center font-bold text-2xl text-brand-700 mb-6">
          Study Buddy
        </h1>
        <div className="card p-6">
          <OnboardingFlow
            initialName={user.name}
            initialGradeLevel={user.gradeLevel}
            initialSchool={user.school}
          />
        </div>
      </div>
    </main>
  );
}
