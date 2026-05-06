// Image storage for chat attachments.
//
// Old format (legacy DB rows):  { data: <base64>, mediaType }
// New format (current writes):   { filename: <userId>__<uuid>.<ext>, mediaType }
//
// Files live under <project-root>/data/uploads/ — outside of `public/` so they
// can't be fetched without an authenticated route handler. The serve endpoint
// validates that the userId prefix in the filename matches the session user.

import { mkdir, writeFile, readFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";

export type StoredImage =
  | { filename: string; mediaType: string } // new
  | { data: string; mediaType: string }; // legacy

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

/** Write a base64-encoded image to disk and return the stored filename. */
export async function storeImage(opts: {
  userId: string;
  base64: string;
  mediaType: string;
}): Promise<{ filename: string; mediaType: string }> {
  await ensureDir();
  const id = randomBytes(16).toString("hex");
  const filename = `${opts.userId}__${id}.${extFor(opts.mediaType)}`;
  const buffer = Buffer.from(opts.base64, "base64");
  await writeFile(join(UPLOAD_DIR, filename), buffer);
  return { filename, mediaType: opts.mediaType };
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
