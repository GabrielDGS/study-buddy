import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen grid place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="block text-center font-bold text-2xl text-brand-700 mb-6"
        >
          Study Buddy
        </Link>
        <div className="card p-6">{children}</div>
      </div>
    </div>
  );
}
