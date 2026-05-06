import Link from "next/link";
import ForgotPasswordForm from "./ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900">Reset your password</h1>
      <p className="text-sm text-slate-500 mt-1">
        Enter your email and we&apos;ll send you a link to choose a new password.
      </p>
      <div className="mt-6">
        <ForgotPasswordForm />
      </div>
      <p className="mt-6 text-sm text-slate-600 text-center">
        Remembered it?{" "}
        <Link href="/login" className="text-brand-600 font-medium hover:underline">
          Back to log in
        </Link>
      </p>
    </>
  );
}
