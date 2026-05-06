"use client";

import { usePathname } from "next/navigation";

/**
 * Wraps page content so it fades + slides in on every navigation.
 * Keying the wrapper by pathname forces a remount on route change,
 * which retriggers the CSS animation.
 */
export default function PageTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="animate-fade-in-up">
      {children}
    </div>
  );
}
