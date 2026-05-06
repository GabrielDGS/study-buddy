import Link from "next/link";
import SignupForm from "./SignupForm";

export default function SignupPage() {
  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900">Create your account</h1>
      <p className="text-sm text-slate-500 mt-1">
        Start scheduling your study sessions in under a minute.
      </p>
      <div className="mt-6">
        <SignupForm />
      </div>
      <p className="mt-6 text-sm text-slate-600 text-center">
        Already have an account?{" "}
        <Link href="/login" className="text-brand-600 font-medium hover:underline">
          Log in
        </Link>
      </p>
    </>
  );
}
