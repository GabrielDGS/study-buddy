import Link from "next/link";
import LoginForm from "./LoginForm";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900">Welcome back</h1>
      <p className="text-sm text-slate-500 mt-1">Log in to continue studying.</p>
      <div className="mt-6">
        <LoginForm next={searchParams.next} />
      </div>
      <p className="mt-6 text-sm text-slate-600 text-center">
        New here?{" "}
        <Link href="/signup" className="text-brand-600 font-medium hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}
