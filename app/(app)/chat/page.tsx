import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import ChatInterface from "./ChatInterface";

type StoredImage =
  | { filename: string; mediaType: string }
  | { data: string; mediaType: string };

function parseImages(json: string | null): StoredImage[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) return parsed as StoredImage[];
  } catch {
    /* ignore */
  }
  return [];
}

function toDisplayUrl(image: StoredImage): string {
  if ("filename" in image) {
    return `/api/images/${image.filename}`;
  }
  return `data:${image.mediaType};base64,${image.data}`;
}

export default async function ChatPage({
  searchParams,
}: {
  searchParams: { starter?: string };
}) {
  const user = (await getCurrentUser())!;
  const messages = await prisma.chatMessage.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 md:px-8 pt-4 md:pt-8 pb-3 md:pb-5 border-b border-slate-200/70 bg-white/60 backdrop-blur-sm">
        <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-slate-900">
          🤖 AI Helper
        </h1>
        <p className="text-sm md:text-lg text-slate-600 mt-1 md:mt-2">
          Ask for a study plan, walk through tough material, or generate a
          practice quiz.
        </p>
      </div>
      <ChatInterface
        initialMessages={messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          imageUrls: parseImages(m.imagesJson).map(toDisplayUrl),
          createdAt: m.createdAt.toISOString(),
        }))}
        initialInput={searchParams.starter ?? ""}
      />
    </div>
  );
}
