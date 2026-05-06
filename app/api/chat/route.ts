import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { chatMessageSchema } from "@/lib/validation";
import { generateAssistantReply, isAiConfigured } from "@/lib/ai";
import { canSendMessage } from "@/lib/quota";
import { storeImage } from "@/lib/imageStore";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const messages = await prisma.chatMessage.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  return NextResponse.json({ messages });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Daily message quota check (counts before we save the new one)
  const quota = await canSendMessage(session.userId);
  if (!quota.allowed) {
    return NextResponse.json(
      { error: quota.reason, quota: { used: quota.used, limit: quota.limit } },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = chatMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { content, images, mode } = parsed.data;

  // Persist incoming images to disk; DB just stores their filenames + types.
  const storedImages: { filename: string; mediaType: string }[] = [];
  for (const img of images) {
    try {
      const stored = await storeImage({
        userId: session.userId,
        base64: img.data,
        mediaType: img.mediaType,
      });
      storedImages.push(stored);
    } catch (err) {
      console.error("Failed to store image:", err);
    }
  }

  const userMessage = await prisma.chatMessage.create({
    data: {
      userId: session.userId,
      role: "user",
      content,
      imagesJson:
        storedImages.length > 0 ? JSON.stringify(storedImages) : null,
    },
  });

  let replyText: string;
  if (!isAiConfigured()) {
    replyText =
      "AI is not configured yet. Add ANTHROPIC_API_KEY to .env and restart the dev server.";
  } else {
    try {
      replyText = await generateAssistantReply({
        userId: session.userId,
        userMessage: content,
        userImages: images, // pass freshly-uploaded base64 once for this call
        mode,
      });
    } catch (err) {
      console.error("AI request failed:", err);
      const detail = err instanceof Error ? err.message : "Unknown error";
      replyText = `Sorry, I hit a snag reaching the AI: ${detail}`;
    }
  }

  const assistantMessage = await prisma.chatMessage.create({
    data: {
      userId: session.userId,
      role: "assistant",
      content: replyText,
    },
  });

  return NextResponse.json({
    userMessage,
    assistantMessage,
    storedImages, // so the client can switch to URL-based display immediately
  });
}

export async function DELETE() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await prisma.chatMessage.deleteMany({ where: { userId: session.userId } });
  return NextResponse.json({ ok: true });
}
