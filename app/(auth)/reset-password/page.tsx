import Link from "next/link";
import ResetPasswordForm from "./ResetPasswordForm";

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token ?? "";

  if (!token) {
    return (
      <>
        <h1 className="text-xl font-semibold text-slate-900">Invalid link</h1>
        <p className="text-sm text-slate-500 mt-1">
          This page needs a valid reset token.{" "}
          <Link
            href="/forgot-password"
            className="text-brand-600 hover:underline"
          >
            Request a new reset link
          </Link>
          .
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900">
        Choose a new password
      </h1>
      <p className="text-sm text-slate-500 mt-1">
        Enter a new password to finish resetting your account.
      </p>
      <div className="mt-6">
        <ResetPasswordForm token={token} />
      </div>
    </>
  );
}
