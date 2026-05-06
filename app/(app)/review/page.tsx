import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getDueReviews, getReviewCounts } from "@/lib/spacedRepetition";
import ReviewRunner from "./ReviewRunner";

export default async function ReviewPage() {
  const user = (await getCurrentUser())!;
  const [reviews, counts] = await Promise.all([
    getDueReviews(user.id),
    getReviewCounts(user.id),
  ]);

  if (reviews.length === 0) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">
            🔁 Review
          </h1>
          <p className="text-lg text-slate-600 mt-2">
            Spaced repetition for questions you missed — they resurface at
            increasing intervals so they actually stick.
          </p>
        </div>

        <div className="card p-10 text-center">
          <div className="text-6xl mb-4">🌱</div>
          <h2 className="text-xl font-semibold text-slate-900">
            Nothing due right now
          </h2>
          <p className="text-slate-600 mt-2 max-w-md mx-auto">
            {counts.upcoming === 0
              ? "When you miss a quiz question, it'll show up here for review tomorrow, then again at 3, 7, 14, and 30 days."
              : `You have ${counts.upcoming} review${counts.upcoming === 1 ? "" : "s"} scheduled for later. Come back when one is due.`}
          </p>
          <Link href="/quizzes" className="btn-primary mt-5 inline-flex">
            Take a practice quiz
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">
          🔁 Review
        </h1>
        <p className="text-lg text-slate-600 mt-2">
          {reviews.length} question{reviews.length === 1 ? "" : "s"} due —
          let&apos;s lock in what you missed.
        </p>
      </div>
      <ReviewRunner reviews={reviews} upcomingCount={counts.upcoming} />
    </div>
  );
}
