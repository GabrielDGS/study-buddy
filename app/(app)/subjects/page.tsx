import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import SubjectsManager from "./SubjectsManager";

export default async function SubjectsPage() {
  const user = (await getCurrentUser())!;
  const subjects = await prisma.subject.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="mb-6 md:mb-8">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          📚 Subjects
        </h1>
        <p className="text-base md:text-lg text-slate-600 mt-1.5 md:mt-2">
          Add and manage the classes you&apos;re taking.
        </p>
      </div>
      <SubjectsManager initialSubjects={subjects} />
    </div>
  );
}
