import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";

export async function POST() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}

/**
 * GET version: clears the session cookie and redirects. Used for self-healing
 * when a stale session cookie points at a user that no longer exists in the
 * database (which would otherwise cause a redirect loop between the
 * authenticated layout and the login page).
 */
export async function GET(request: Request) {
  await clearSessionCookie();
  const url = new URL(request.url);
  const next = url.searchParams.get("next") || "/login";
  return NextResponse.redirect(new URL(next, url.origin));
}
