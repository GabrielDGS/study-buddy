import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function HomePage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <main className="min-h-screen flex flex-col">
      <header className="px-8 py-5 flex items-center justify-between">
        <div className="font-bold text-2xl bg-gradient-to-br from-brand-600 to-pink-500 bg-clip-text text-transparent">
          Study Buddy
        </div>
        <nav className="flex gap-3">
          <Link href="/login" className="btn-ghost">
            Log in
          </Link>
          <Link href="/signup" className="btn-primary">
            Get started
          </Link>
        </nav>
      </header>
      <section className="flex-1 grid place-items-center px-6">
        <div className="max-w-3xl text-center animate-fade-in-up">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/70 backdrop-blur px-4 py-1.5 text-sm font-medium text-brand-700 border border-brand-200/60 mb-6">
            <span aria-hidden>✨</span> Your AI-powered study planner
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-slate-900 leading-tight">
            Beat procrastination,
            <br />
            <span className="bg-gradient-to-br from-brand-600 via-purple-600 to-pink-500 bg-clip-text text-transparent">
              one study session at a time.
            </span>
          </h1>
          <p className="mt-6 text-xl text-slate-600 max-w-2xl mx-auto">
            Track your subjects, schedule your tests and assignments, and let
            your AI study buddy build practice quizzes from your materials.
          </p>
          <div className="mt-10 flex justify-center gap-3 flex-wrap">
            <Link href="/signup" className="btn-primary text-base px-6 py-3">
              Create your profile →
            </Link>
            <Link href="/login" className="btn-secondary text-base px-6 py-3">
              I already have an account
            </Link>
          </div>
          <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto text-left">
            <FeatureChip icon="📅" title="Calendar view" body="See every test and deadline at a glance." />
            <FeatureChip icon="📚" title="All your subjects" body="Color-code each class so nothing blurs together." />
            <FeatureChip icon="🤖" title="AI study help" body="Generate practice quizzes from any material." />
          </div>
        </div>
      </section>
      <footer className="text-center text-sm text-slate-400 py-6">
        Built for students who want to study smarter.
      </footer>
    </main>
  );
}

function FeatureChip({
  icon,
  title,
  body,
}: {
  icon: string;
  title: string;
  body: string;
}) {
  return (
    <div className="card p-4 transition-all hover:scale-[1.03] hover:shadow-md">
      <div className="text-2xl" aria-hidden>
        {icon}
      </div>
      <div className="font-semibold text-slate-900 mt-1">{title}</div>
      <div className="text-sm text-slate-600 mt-1">{body}</div>
    </div>
  );
}
