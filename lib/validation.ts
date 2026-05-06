import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  gradeLevel: z.string().trim().max(40).optional().nullable(),
  school: z.string().trim().max(120).optional().nullable(),
});

export const subjectSchema = z.object({
  name: z.string().trim().min(1, "Subject name is required").max(80),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a hex like #3b82f6")
    .default("#3b82f6"),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const scheduleItemSchema = z.object({
  title: z.string().trim().min(1).max(120),
  type: z.enum(["test", "quiz", "assignment", "study"]),
  subjectId: z.string().optional().nullable(),
  dueDate: z.string().datetime().or(z.string().min(1)),
  studyStart: z.string().optional().nullable(),
  estMinutes: z.number().int().positive().max(60 * 24).optional().nullable(),
  status: z.enum(["pending", "in_progress", "done"]).default("pending"),
  notes: z.string().max(1000).optional().nullable(),
});

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

export const chatImageSchema = z.object({
  data: z.string().min(1), // base64 (no data URI prefix)
  mediaType: z.enum(ALLOWED_IMAGE_TYPES),
});

export const flashcardSchema = z.object({
  front: z.string().trim().min(1, "Front side required").max(500),
  back: z.string().trim().min(1, "Back side required").max(2000),
  hint: z.string().trim().max(500).optional().nullable(),
});

export const flashcardDeckSchema = z.object({
  title: z.string().trim().min(1, "Deck title required").max(120),
  description: z.string().trim().max(500).optional().nullable(),
  subjectId: z.string().optional().nullable(),
});

export const chatMessageSchema = z
  .object({
    content: z.string().trim().max(4000).default(""),
    images: z.array(chatImageSchema).max(4).default([]),
    mode: z.enum(["normal", "tutor"]).default("normal"),
  })
  .refine((v) => v.content.length > 0 || v.images.length > 0, {
    message: "Send a message or attach an image.",
  });
