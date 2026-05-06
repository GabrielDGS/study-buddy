import { NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";

const forgotSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

const TOKEN_TTL_MINUTES = 60;

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = forgotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid email address" },
      { status: 400 }
    );
  }

  const { email } = parsed.data;

  // Always respond the same way regardless of whether the email exists,
  // so an attacker cannot enumerate registered emails.
  const user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    // Invalidate any existing unused tokens for this user
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const origin = new URL(request.url).origin;
    const resetUrl = `${origin}/reset-password?token=${rawToken}`;

    try {
      await sendEmail({
        to: user.email,
        subject: "Reset your Study Buddy password",
        text: [
          `Hi ${user.name},`,
          "",
          "Someone requested a password reset for your Study Buddy account.",
          "Click the link below to choose a new password. The link is valid for 1 hour.",
          "",
          resetUrl,
          "",
          "If you didn't request this, just ignore this email — your password won't change.",
          "",
          "— Study Buddy",
        ].join("\n"),
      });
    } catch (err) {
      console.error("Failed to send password reset email:", err);
    }
  }

  return NextResponse.json({
    ok: true,
    message:
      "If that email is registered, a reset link has been sent. Check your inbox (or in dev mode, your server console).",
  });
}
