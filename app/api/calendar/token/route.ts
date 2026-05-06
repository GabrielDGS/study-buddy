import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

/**
 * Get the current user's calendar token (creates one if none exists).
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { calendarToken: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let token = user.calendarToken;
  if (!token) {
    token = randomBytes(24).toString("hex");
    await prisma.user.update({
      where: { id: session.userId },
      data: { calendarToken: token },
    });
  }
  return NextResponse.json({ token });
}

/**
 * Rotate (regenerate) the user's calendar token, invalidating any prior
 * subscription URLs.
 */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = randomBytes(24).toString("hex");
  await prisma.user.update({
    where: { id: session.userId },
    data: { calendarToken: token },
  });
  return NextResponse.json({ token });
}
