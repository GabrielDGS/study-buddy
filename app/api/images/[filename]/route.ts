import { NextResponse } from "next/server";
import { existsSync } from "fs";
import { getSession } from "@/lib/auth";
import {
  imagePathFor,
  ownsImage,
  readImageBytes,
} from "@/lib/imageStore";

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
};

export async function GET(
  _request: Request,
  { params }: { params: { filename: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { filename } = params;
  if (!ownsImage(session.userId, filename)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!existsSync(imagePathFor(filename))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const bytes = await readImageBytes(filename);
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const mime = MIME_BY_EXT[ext] ?? "application/octet-stream";

  // Convert Buffer to a Uint8Array (a valid BodyInit) before handing to Response.
  const body = new Uint8Array(bytes);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
