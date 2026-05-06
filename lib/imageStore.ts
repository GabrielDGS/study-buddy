// Image storage for chat attachments.
//
// Two storage formats are supported:
//   { filename: <userId>__<uuid>.<ext>, mediaType }   ← disk-backed (local dev)
//   { data: <base64>, mediaType }                     ← inline in DB (legacy + serverless)
//
// On a writable filesystem (local dev) we save image bytes to disk under
// <project-root>/data/uploads/ and store only the filename in the DB.
//
// On serverless platforms like Vercel where the filesystem is read-only, we
// fall back to storing the base64 data directly in the DB. This is slower
// once chat history grows but it's the only thing that works without
// integrating an object storage service. Older messages already in this
// format continue to render via the same readers.

import { mkdir, writeFile, readFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";

export type StoredImage =
  | { filename: string; mediaType: string }
  | { data: string; mediaType: string };

/**
 * Are we running on a serverless platform with a read-only filesystem?
 * `VERCEL` is set automatically on Vercel; we also let users force-disable
 * disk storage with STUDYBUDDY_DISK_UPLOADS=0 for environments we don't know about.
 */
function isServerlessFilesystem(): boolean {
  if (process.env.STUDYBUDDY_DISK_UPLOADS === "0") return true;
  if (process.env.VERCEL) return true;
  if (process.env.AWS_LAMBDA_FUNCTION_NAME) return true;
  return false;
}

const UPLOAD_DIR = join(process.cwd(), "data", "uploads");

const MEDIA_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

function extFor(mediaType: string): string {
  return MEDIA_TO_EXT[mediaType] ?? "bin";
}

async function ensureDir() {
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }
}

/** Persist an image. Disk-backed when possible; otherwise inline base64. */
export async function storeImage(opts: {
  userId: string;
  base64: string;
  mediaType: string;
}): Promise<StoredImage> {
  if (isServerlessFilesystem()) {
    // Inline in DB — works anywhere, no disk needed.
    return { data: opts.base64, mediaType: opts.mediaType };
  }
  try {
    await ensureDir();
    const id = randomBytes(16).toString("hex");
    const filename = `${opts.userId}__${id}.${extFor(opts.mediaType)}`;
    const buffer = Buffer.from(opts.base64, "base64");
    await writeFile(join(UPLOAD_DIR, filename), buffer);
    return { filename, mediaType: opts.mediaType };
  } catch {
    // Disk write failed (read-only fs on a platform we didn't detect).
    return { data: opts.base64, mediaType: opts.mediaType };
  }
}

/** Validate filename ownership: filename must start with `<userId>__`. */
export function ownsImage(userId: string, filename: string): boolean {
  // Block any path traversal characters
  if (
    filename.includes("/") ||
    filename.includes("\\") ||
    filename.includes("..")
  ) {
    return false;
  }
  return filename.startsWith(`${userId}__`);
}

export function imagePathFor(filename: string): string {
  return join(UPLOAD_DIR, filename);
}

/** Read an image file from disk and return its raw bytes. */
export async function readImageBytes(filename: string): Promise<Buffer> {
  return readFile(imagePathFor(filename));
}

/** Display URL for the chat UI. Returns either the served route or a data URI. */
export function imageDisplayUrl(image: StoredImage): string {
  if ("filename" in image) {
    return `/api/images/${image.filename}`;
  }
  return `data:${image.mediaType};base64,${image.data}`;
}

/** Returns base64 data + mediaType, suitable for the Anthropic vision API. */
export async function imageAsBase64(
  image: StoredImage
): Promise<{ data: string; mediaType: string }> {
  if ("filename" in image) {
    const buf = await readImageBytes(image.filename);
    return { data: buf.toString("base64"), mediaType: image.mediaType };
  }
  return { data: image.data, mediaType: image.mediaType };
}

export function isStoredImageNew(
  i: StoredImage
): i is { filename: string; mediaType: string } {
  return (i as { filename?: string }).filename !== undefined;
}
