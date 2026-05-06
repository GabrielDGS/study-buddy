import { readFileSync, existsSync } from "fs";
import { join } from "path";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "./db";
import { canCreateQuiz } from "./quota";
import { imageAsBase64, type StoredImage } from "./imageStore";

const MODEL = "claude-sonnet-4-5";
const MAX_TOKENS = 8000;
const HISTORY_TURNS = 10;
const MAX_TOOL_ITERATIONS = 6;

const TUTOR_MODE_ADDENDUM = [
  "## TUTOR MODE",
  "The student has turned on TUTOR MODE. The default behavior changes:",
  "",
  "1. **Default to Socratic guidance.** When the student asks a homework, test, quiz, project, or practice question, START by walking them through it step-by-step rather than just stating the answer.",
  "2. **One step at a time** by default. Identify the first sub-step, give a small leading hint or ask what they think comes next, then wait. Don't dump every step in one message unless asked (see #6).",
  "3. **Use leading questions** when natural. 'What does the formula say happens when X equals zero?' 'Which rule applies here?'",
  "4. **Praise correct reasoning** explicitly, then prompt the next step.",
  "5. **When they're stuck on a sub-step**, give a targeted hint pointing to the relevant concept — but don't skip ahead to the final answer.",
  "6. **EXPLICIT step-by-step requests OVERRIDE the default.** If the student asks any of: 'show me the steps', 'give me the full solution', 'walk me through the whole thing', 'just show me how to solve it', 'I want to see the process', 'show me how to get the answer', or anything similar — GIVE THEM THE COMPLETE STEP-BY-STEP SOLUTION with clear numbered steps and reasoning at each step. Don't refuse, don't redirect, don't make them work it out themselves. The point of tutor mode is to TEACH; sometimes that means showing the worked example end-to-end. After showing the solution, you can offer to give them a similar problem to try.",
  "7. **If they say 'I give up' or 'just tell me'** — show the answer with reasoning, no friction.",
  "8. **For multi-part problems**, prefer step-by-step guidance (rule #2) unless rule #6 applies.",
  "9. **End each guided turn with either a question or a clear prompt for them to attempt the next step.** End full-solution turns with an offer to try a similar problem or get a deeper explanation.",
  "",
  "Tools (create_practice_quiz, create_schedule_items, etc.) are still available; use them normally if the student requests something that calls for them.",
].join("\n");

/**
 * Resolve the Anthropic API key.
 *
 * Why this isn't just `process.env.ANTHROPIC_API_KEY`: in some environments
 * the parent shell exports the variable as an EMPTY string. Next.js's dotenv
 * loader treats that as "already defined" and refuses to overwrite, so the
 * value in .env never reaches the runtime. We work around that by falling
 * back to reading .env directly when the env var is empty.
 */
function resolveApiKey(): string {
  const fromEnv = process.env.ANTHROPIC_API_KEY;
  if (fromEnv && fromEnv.length > 0) return fromEnv;

  const envPath = join(process.cwd(), ".env");
  if (!existsSync(envPath)) return "";
  try {
    const text = readFileSync(envPath, "utf8");
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq < 0) continue;
      const key = line.slice(0, eq).trim();
      if (key !== "ANTHROPIC_API_KEY") continue;
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      return value;
    }
  } catch {
    /* ignore */
  }
  return "";
}

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) {
    const apiKey = resolveApiKey();
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not set in .env");
    }
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

export function isAiConfigured(): boolean {
  return resolveApiKey().length > 0;
}

export type ImageInput = {
  data: string;
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
};

type StoredMessage = {
  role: string;
  content: string;
  imagesJson: string | null;
};

function storedImagesFromMessage(stored: StoredMessage): StoredImage[] {
  if (!stored.imagesJson) return [];
  try {
    const parsed = JSON.parse(stored.imagesJson);
    if (Array.isArray(parsed)) return parsed as StoredImage[];
  } catch {
    /* ignore */
  }
  return [];
}

async function loadImagesAsBase64(
  stored: StoredMessage
): Promise<ImageInput[]> {
  const images = storedImagesFromMessage(stored);
  const out: ImageInput[] = [];
  for (const img of images) {
    try {
      const { data, mediaType } = await imageAsBase64(img);
      out.push({
        data,
        mediaType: mediaType as ImageInput["mediaType"],
      });
    } catch (err) {
      console.warn("Failed to load image for AI:", err);
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tools
// ─────────────────────────────────────────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: "create_practice_quiz",
    description:
      "Create a saved practice quiz/test in the user's Practice Quizzes tab. Use this whenever the user asks for a quiz or practice test on any topic. Build the questions yourself based on the topic; do not ask follow-up questions unless the topic is ambiguous. Aim for 8–10 questions. CRITICAL: questions must be diverse — never include two questions that test the same skill or formula with only the numbers swapped. See the system prompt's 'Question diversity' section for detailed requirements.",
    input_schema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description:
            "Short title for the quiz, e.g. 'Photosynthesis basics' or 'WWII key dates'.",
        },
        subjectName: {
          type: "string",
          description:
            "Optional: name of one of the user's existing subjects to associate the quiz with. Match exactly or omit if no clear match.",
        },
        sourceText: {
          type: "string",
          description:
            "Optional: a brief summary of the material the quiz was generated from.",
        },
        questions: {
          type: "array",
          minItems: 1,
          maxItems: 25,
          description: "List of questions. Order matters.",
          items: {
            type: "object",
            properties: {
              prompt: {
                type: "string",
                description: "The question text.",
              },
              type: {
                type: "string",
                enum: ["multiple_choice", "true_false", "short_answer"],
              },
              options: {
                type: "array",
                items: { type: "string" },
                description:
                  "For multiple_choice questions only: 3-5 distinct options including the correct one.",
              },
              correctAnswer: {
                type: "string",
                description:
                  "The correct answer. For multiple_choice, must exactly match one of the options. For true_false, must be 'True' or 'False'. For short_answer, the canonical answer (case-insensitive comparison will be used).",
              },
              explanation: {
                type: "string",
                description:
                  "1-2 sentence explanation of why the correct answer is correct, shown to the student when they reveal the answer.",
              },
            },
            required: ["prompt", "type", "correctAnswer"],
          },
        },
      },
      required: ["title", "questions"],
    },
  },
  {
    name: "create_schedule_items",
    description:
      "Add items to the user's Schedule calendar. Use this whenever the user asks to add tests, quizzes, assignments, study sessions, or generates a study schedule. Convert relative dates ('next Monday', 'in two weeks') into absolute ISO 8601 datetimes using today's date provided in the system prompt.",
    input_schema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          minItems: 1,
          maxItems: 30,
          items: {
            type: "object",
            properties: {
              title: {
                type: "string",
                description:
                  "Title of the item, e.g. 'Study Bio Chapter 7' or 'Chemistry midterm'.",
              },
              type: {
                type: "string",
                enum: ["test", "quiz", "assignment", "study"],
                description:
                  "'study' for study sessions you create, 'test'/'quiz'/'assignment' for graded events.",
              },
              subjectName: {
                type: "string",
                description:
                  "Optional: name of an existing subject. Match exactly or omit.",
              },
              dueDate: {
                type: "string",
                description:
                  "ISO 8601 datetime string (e.g. '2026-05-12T15:00:00'). Required.",
              },
              estMinutes: {
                type: "integer",
                minimum: 5,
                maximum: 600,
                description:
                  "Estimated minutes for this item, especially for study sessions.",
              },
              notes: {
                type: "string",
                description: "Optional short notes.",
              },
            },
            required: ["title", "type", "dueDate"],
          },
        },
      },
      required: ["items"],
    },
  },
  {
    name: "list_schedule_items",
    description:
      "Read the user's current schedule. Use this BEFORE rebalancing or modifying items so you know their IDs and dates. Returns recent items grouped by past (missed/done) and upcoming.",
    input_schema: {
      type: "object",
      properties: {
        includePast: {
          type: "boolean",
          description: "Whether to include past items (default true).",
        },
        daysAhead: {
          type: "integer",
          minimum: 1,
          maximum: 90,
          description:
            "How many days into the future to include. Default 30.",
        },
      },
    },
  },
  {
    name: "update_schedule_item",
    description:
      "Move or edit one of the user's existing schedule items. Use this to reschedule a missed study session, push back a test the student couldn't get to, or fix details. You must know the exact item id (use list_schedule_items first if you don't).",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "The schedule item id." },
        title: { type: "string" },
        type: {
          type: "string",
          enum: ["test", "quiz", "assignment", "study"],
        },
        dueDate: {
          type: "string",
          description: "New ISO 8601 datetime for when the item is due.",
        },
        estMinutes: { type: "integer", minimum: 5, maximum: 600 },
        notes: { type: "string" },
        status: { type: "string", enum: ["pending", "in_progress", "done"] },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_schedule_item",
    description:
      "Delete a schedule item the user no longer needs. Use sparingly — usually update_schedule_item is the right call.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Tool execution
// ─────────────────────────────────────────────────────────────────────────────

type QuestionInput = {
  prompt: string;
  type: "multiple_choice" | "true_false" | "short_answer";
  options?: string[];
  correctAnswer: string;
  explanation?: string;
};

type CreateQuizInput = {
  title: string;
  subjectName?: string;
  sourceText?: string;
  questions: QuestionInput[];
};

type ScheduleItemInput = {
  title: string;
  type: "test" | "quiz" | "assignment" | "study";
  subjectName?: string;
  dueDate: string;
  estMinutes?: number;
  notes?: string;
};

type CreateScheduleInput = {
  items: ScheduleItemInput[];
};

async function findSubjectByName(userId: string, name?: string) {
  if (!name) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  const subjects = await prisma.subject.findMany({ where: { userId } });
  return (
    subjects.find(
      (s) => s.name.toLowerCase() === trimmed.toLowerCase()
    ) ?? null
  );
}

async function executeCreateQuiz(
  userId: string,
  input: CreateQuizInput
): Promise<
  | { summary: string; quizId: string; quizUrl: string }
  | { error: string }
> {
  if (!input || typeof input !== "object") {
    throw new Error("Quiz input was empty.");
  }
  // Daily quiz quota gate — return an error tool result so the AI tells the user.
  const quotaCheck = await canCreateQuiz(userId);
  if (!quotaCheck.allowed) {
    return { error: quotaCheck.reason ?? "Daily quiz limit reached." };
  }
  const title = (input.title ?? "Untitled quiz").toString().slice(0, 200);
  const rawQuestions = Array.isArray(input.questions) ? input.questions : [];
  const cleanQuestions = rawQuestions
    .map((q, i) => {
      if (!q || typeof q !== "object") return null;
      const prompt = (q.prompt ?? "").toString().trim();
      const type = (q.type ?? "short_answer").toString();
      const correctAnswer = (q.correctAnswer ?? "").toString().trim();
      if (!prompt || !correctAnswer) return null;
      const isValidType = ["multiple_choice", "true_false", "short_answer"].includes(
        type
      );
      return {
        orderIndex: i,
        prompt: prompt.slice(0, 1000),
        type: isValidType ? type : "short_answer",
        optionsJson:
          type === "multiple_choice" && Array.isArray(q.options)
            ? JSON.stringify(q.options.slice(0, 8).map((o) => String(o)))
            : null,
        correctAnswer: correctAnswer.slice(0, 500),
        explanation:
          q.explanation === undefined || q.explanation === null
            ? null
            : String(q.explanation).slice(0, 1000),
      };
    })
    .filter((q): q is NonNullable<typeof q> => q !== null);

  if (cleanQuestions.length === 0) {
    throw new Error("Quiz had no valid questions.");
  }

  const subject = await findSubjectByName(userId, input.subjectName);
  const quiz = await prisma.quiz.create({
    data: {
      userId,
      subjectId: subject?.id ?? null,
      title,
      sourceText: input.sourceText
        ? String(input.sourceText).slice(0, 4000)
        : null,
      questions: { create: cleanQuestions },
    },
  });

  return {
    summary: `Created practice quiz "${quiz.title}" with ${cleanQuestions.length} question${cleanQuestions.length === 1 ? "" : "s"}${subject ? ` in ${subject.name}` : ""}.`,
    quizId: quiz.id,
    quizUrl: `/quizzes/${quiz.id}`,
  };
}

async function executeCreateSchedule(
  userId: string,
  input: CreateScheduleInput
): Promise<{ summary: string; created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;
  for (const item of input.items) {
    const due = new Date(item.dueDate);
    if (Number.isNaN(due.getTime())) {
      skipped += 1;
      continue;
    }
    const subject = await findSubjectByName(userId, item.subjectName);
    await prisma.scheduleItem.create({
      data: {
        userId,
        subjectId: subject?.id ?? null,
        title: item.title.slice(0, 200),
        type: item.type,
        dueDate: due,
        estMinutes:
          typeof item.estMinutes === "number" ? item.estMinutes : null,
        notes: item.notes?.slice(0, 1000) ?? null,
        status: "pending",
      },
    });
    created += 1;
  }
  return {
    summary: `Added ${created} item${created === 1 ? "" : "s"} to your schedule${skipped > 0 ? ` (${skipped} skipped due to invalid dates)` : ""}.`,
    created,
    skipped,
  };
}

async function executeListSchedule(
  userId: string,
  input: { includePast?: boolean; daysAhead?: number }
) {
  const includePast = input.includePast !== false;
  const daysAhead = Math.max(1, Math.min(90, input.daysAhead ?? 30));
  const now = new Date();
  const horizonStart = new Date(now);
  horizonStart.setDate(horizonStart.getDate() - 30);
  const horizonEnd = new Date(now);
  horizonEnd.setDate(horizonEnd.getDate() + daysAhead);

  const items = await prisma.scheduleItem.findMany({
    where: {
      userId,
      dueDate: { gte: includePast ? horizonStart : now, lte: horizonEnd },
    },
    orderBy: { dueDate: "asc" },
    include: { subject: { select: { name: true } } },
  });

  const past: typeof items = [];
  const upcoming: typeof items = [];
  for (const i of items) {
    if (i.dueDate.getTime() < now.getTime()) past.push(i);
    else upcoming.push(i);
  }

  const fmt = (i: (typeof items)[number]) => ({
    id: i.id,
    title: i.title,
    type: i.type,
    subject: i.subject?.name ?? null,
    dueDate: i.dueDate.toISOString(),
    estMinutes: i.estMinutes,
    status: i.status,
    isMissed:
      i.dueDate.getTime() < now.getTime() && i.status !== "done",
    notes: i.notes,
  });

  return {
    today: now.toISOString(),
    past: past.map(fmt),
    upcoming: upcoming.map(fmt),
    missedCount: past.filter((i) => i.status !== "done").length,
  };
}

type UpdateScheduleInput = {
  id: string;
  title?: string;
  type?: "test" | "quiz" | "assignment" | "study";
  dueDate?: string;
  estMinutes?: number;
  notes?: string;
  status?: "pending" | "in_progress" | "done";
};

async function executeUpdateSchedule(
  userId: string,
  input: UpdateScheduleInput
): Promise<{ summary: string } | { error: string }> {
  const existing = await prisma.scheduleItem.findUnique({
    where: { id: input.id },
  });
  if (!existing || existing.userId !== userId) {
    return { error: `Schedule item not found or not yours.` };
  }

  const data: Record<string, unknown> = {};
  if (typeof input.title === "string")
    data.title = input.title.slice(0, 200);
  if (input.type) data.type = input.type;
  if (input.dueDate) {
    const d = new Date(input.dueDate);
    if (Number.isNaN(d.getTime())) {
      return { error: `Invalid dueDate: ${input.dueDate}` };
    }
    data.dueDate = d;
  }
  if (typeof input.estMinutes === "number") data.estMinutes = input.estMinutes;
  if (typeof input.notes === "string") data.notes = input.notes.slice(0, 1000);
  if (input.status) data.status = input.status;

  const updated = await prisma.scheduleItem.update({
    where: { id: input.id },
    data,
  });
  return {
    summary: `Updated "${updated.title}" — now ${updated.type} due ${updated.dueDate.toLocaleString()}.`,
  };
}

async function executeDeleteSchedule(
  userId: string,
  input: { id: string }
): Promise<{ summary: string } | { error: string }> {
  const existing = await prisma.scheduleItem.findUnique({
    where: { id: input.id },
  });
  if (!existing || existing.userId !== userId) {
    return { error: `Schedule item not found or not yours.` };
  }
  await prisma.scheduleItem.delete({ where: { id: input.id } });
  return { summary: `Deleted "${existing.title}" from your schedule.` };
}

async function executeTool(
  userId: string,
  name: string,
  input: unknown
): Promise<{ toolResult: unknown; humanSummary: string }> {
  if (name === "create_practice_quiz") {
    const result = await executeCreateQuiz(userId, input as CreateQuizInput);
    if ("error" in result) {
      return {
        toolResult: { error: result.error },
        humanSummary: result.error,
      };
    }
    return {
      toolResult: result,
      humanSummary: result.summary,
    };
  }
  if (name === "create_schedule_items") {
    const result = await executeCreateSchedule(
      userId,
      input as CreateScheduleInput
    );
    return {
      toolResult: result,
      humanSummary: result.summary,
    };
  }
  if (name === "list_schedule_items") {
    const result = await executeListSchedule(
      userId,
      input as { includePast?: boolean; daysAhead?: number }
    );
    return {
      toolResult: result,
      humanSummary: `Listed ${result.upcoming.length} upcoming and ${result.past.length} past items (${result.missedCount} missed).`,
    };
  }
  if (name === "update_schedule_item") {
    const result = await executeUpdateSchedule(
      userId,
      input as UpdateScheduleInput
    );
    if ("error" in result) {
      return { toolResult: { error: result.error }, humanSummary: result.error };
    }
    return { toolResult: result, humanSummary: result.summary };
  }
  if (name === "delete_schedule_item") {
    const result = await executeDeleteSchedule(
      userId,
      input as { id: string }
    );
    if ("error" in result) {
      return { toolResult: { error: result.error }, humanSummary: result.error };
    }
    return { toolResult: result, humanSummary: result.summary };
  }
  return {
    toolResult: { error: `Unknown tool: ${name}` },
    humanSummary: `Unknown tool: ${name}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// System prompt
// ─────────────────────────────────────────────────────────────────────────────

async function buildSystemPrompt(userId: string): Promise<string> {
  const [user, subjects, upcoming] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, gradeLevel: true, school: true },
    }),
    prisma.subject.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { name: true, notes: true },
    }),
    prisma.scheduleItem.findMany({
      where: {
        userId,
        status: { not: "done" },
        dueDate: { gte: new Date(Date.now() - 1000 * 60 * 60 * 12) },
      },
      orderBy: { dueDate: "asc" },
      take: 12,
      include: { subject: { select: { name: true } } },
    }),
  ]);

  const today = new Date();
  const todayLong = today.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const todayIso = today.toISOString();

  const subjectLines =
    subjects.length === 0
      ? "  (none yet)"
      : subjects
          .map(
            (s) =>
              `  - ${s.name}${s.notes ? ` — notes: ${s.notes.slice(0, 200)}` : ""}`
          )
          .join("\n");

  const upcomingLines =
    upcoming.length === 0
      ? "  (nothing scheduled)"
      : upcoming
          .map((u) => {
            const d = new Date(u.dueDate);
            return `  - ${u.title} (${u.type}, ${u.subject?.name ?? "no subject"}) due ${d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}`;
          })
          .join("\n");

  return [
    `You are Study Buddy, a friendly, focused AI study assistant helping ${user?.name ?? "a student"}.`,
    user?.gradeLevel ? `Grade level: ${user.gradeLevel}.` : null,
    user?.school ? `School: ${user.school}.` : null,
    `Today is ${todayLong} (ISO: ${todayIso}).`,
    "",
    "The student's subjects:",
    subjectLines,
    "",
    "Upcoming items already on their schedule:",
    upcomingLines,
    "",
    "## Tools",
    "You have several tools that perform real database writes for the student:",
    "",
    "1. **create_practice_quiz** — When the user asks for a practice quiz or test, USE THIS TOOL to actually save it. Do NOT just list the questions in chat. After the tool succeeds, write a 1-2 sentence reply telling the student the quiz is ready in the Practice Quizzes tab and include a markdown link [Open the quiz](/quizzes/QUIZ_ID).",
    "",
    "2. **create_schedule_items** — When the user asks to add tests/quizzes/assignments to their calendar OR asks for a study schedule for upcoming events, USE THIS TOOL to add the items. Convert any relative dates into absolute ISO 8601 datetimes based on today's date. For study schedules, create multiple 'study' items spread across the days leading up to the test/exam. After the tool succeeds, write a 1-2 sentence reply telling them the items are on their Schedule and include a markdown link [View Schedule](/schedule).",
    "",
    "3. **list_schedule_items** — Read the user's current schedule. Call this BEFORE rebalancing or modifying anything so you know which items exist and their IDs.",
    "",
    "4. **update_schedule_item** — Move, reschedule, or edit an existing item. Use this for rebalancing missed sessions and pushing back items the user couldn't get to.",
    "",
    "5. **delete_schedule_item** — Remove an item the user no longer needs.",
    "",
    "## Adaptive scheduling / rebalancing",
    "When the user asks to rebalance, fix, or replan their schedule (e.g. 'I missed my Tuesday study session, fix my schedule', 'rebalance my week', 'my Friday test got moved'):",
    "1. Call **list_schedule_items** first to see what's there. Pay special attention to items where `isMissed: true` — those are past-due items the student didn't complete.",
    "2. Decide whether each missed study session should be (a) moved to a later date that doesn't conflict, (b) merged into another existing session, or (c) deleted if no longer needed. Don't pile too much onto a single day.",
    "3. Call **update_schedule_item** for each item to be moved (with the new dueDate), and **create_schedule_items** if you need to add net-new sessions to keep the workload balanced.",
    "4. Then write a brief summary of what you changed (use a bulleted list) and include [View Schedule](/schedule).",
    "",
    "## Quiz size and multi-quiz requests",
    "**CRITICAL: Keep each individual quiz to 10 questions MAXIMUM.** Going larger risks truncating mid-output.",
    "- If the user asks for one quiz on a focused topic → make ONE call with ≤10 questions.",
    "- If the user asks for a comprehensive test covering many topics, or quizzes for multiple subjects → make MULTIPLE separate create_practice_quiz calls, each with ≤10 questions, each titled clearly (e.g. 'AP Calc BC – Limits & Continuity', 'AP Calc BC – Derivatives'). You can make several tool calls in one response.",
    "- Cover the full course by topic across multiple quizzes rather than cramming everything into one.",
    "",
    "## Question diversity (very important)",
    "Students learn nothing from 10 versions of the same problem with different numbers. Every quiz MUST have real variety:",
    "",
    "1. **Cover different sub-skills**, not the same skill with new numbers. Before writing, list 6-8 distinct sub-topics for the quiz subject and assign at most 1-2 questions to each. Example for 'AP Calc BC – Derivatives': power rule, product rule, quotient rule, chain rule, implicit differentiation, related rates, derivative-as-rate interpretation, second-derivative analysis. NOT 'find dy/dx of 8 different polynomials'.",
    "",
    "2. **Mix question formats** within a single quiz: roughly 50% multiple_choice, 25% short_answer, 25% true_false. Never make a quiz of all-one-type unless the user asked for it.",
    "",
    "3. **Mix difficulty (Bloom's levels)**: include some recall (definitions, identifying terms), some application (use a formula/concept), and some analysis (compare two cases, spot the error, multi-step reasoning).",
    "",
    "4. **Test different question shapes**: definitions, conceptual 'why does X happen', solve-a-problem, identify-the-misconception, interpret a result, compare two scenarios, edge cases. Don't just ask 'compute X' eight times.",
    "",
    "5. **Vary distractors** in multiple-choice. Wrong answers should reflect realistic mistakes (sign errors, wrong formula, off-by-one, common misconception), not random plausibility.",
    "",
    "6. **Self-check before submitting**: re-read your generated questions. If any two could be solved by literally the same procedure with swapped numbers, replace one of them.",
    "",
    "## Math, formulas, and symbols",
    "Chat output is rendered as Markdown with KaTeX math support. ALWAYS use LaTeX for mathematical expressions, not plaintext or unicode tricks:",
    "- Inline math: wrap with single dollar signs, e.g. `$x^2 + 3x - 4$`, `$\\frac{a}{b}$`, `$\\sqrt{x}$`, `$\\int_0^1 f(x)\\,dx$`.",
    "- Block math: wrap with double dollar signs on their own lines, e.g. `$$E = mc^2$$`.",
    "- DO NOT write things like `x^2` or `1/2` as plain text; render `$x^2$` and `$\\frac{1}{2}$` instead.",
    "- DO NOT use unicode lookalikes (e.g. ℝ, ²) when LaTeX would be cleaner — write `$\\mathbb{R}$` and `$x^2$`.",
    "- Greek letters: `$\\alpha$`, `$\\beta$`, `$\\theta$`, `$\\pi$`, `$\\Sigma$`, etc.",
    "- Common symbols: `$\\le$`, `$\\ge$`, `$\\ne$`, `$\\approx$`, `$\\to$`, `$\\infty$`, `$\\pm$`.",
    "",
    "## Guidelines",
    "- Default to using tools rather than describing things in chat. If they ask for a quiz, MAKE IT. If they ask to plan their week, ADD THE STUDY SESSIONS.",
    "- Match `subjectName` to existing subjects exactly when possible; otherwise omit it.",
    "- For study sessions, use type='study'. For graded events the user has, use 'test', 'quiz', or 'assignment'.",
    "- If the student shares an image (a syllabus, notes, a textbook page, a problem), read it carefully and use it to ground your answer.",
    "- Be concise in chat replies. Use short paragraphs and lists. After tool use, just confirm + link.",
    "- If you can't determine necessary info (e.g. exact test date), ask one focused question.",
  ]
    .filter(Boolean)
    .join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Generate a focused practice quiz from structured input
// ─────────────────────────────────────────────────────────────────────────────

export async function generateSpecificQuiz(opts: {
  userId: string;
  topic: string;
  subtopics: string;
  subjectId: string | null;
  difficulty: "easy" | "medium" | "hard" | "mixed";
  count: number;
}): Promise<
  | { quizId: string; quizUrl: string; questionCount: number }
  | { error: string }
> {
  const quotaCheck = await canCreateQuiz(opts.userId);
  if (!quotaCheck.allowed) {
    return { error: quotaCheck.reason ?? "Daily quiz limit reached." };
  }

  let subjectName = "";
  if (opts.subjectId) {
    const subject = await prisma.subject.findUnique({
      where: { id: opts.subjectId },
    });
    if (!subject || subject.userId !== opts.userId) {
      return { error: "Invalid subject." };
    }
    subjectName = subject.name;
  }

  const count = Math.max(4, Math.min(15, Math.round(opts.count)));

  const systemPrompt = [
    "You write tightly-scoped practice quizzes for students.",
    "Output via the create_practice_quiz tool — DO NOT just describe questions in text.",
    "For math/science, use LaTeX for ALL math (e.g. `$\\frac{a}{b}$`, `$x^2 + 3x = 0$`).",
    "Each question MUST have a 1-2 sentence `explanation` for the correct answer.",
    "",
    "Question diversity rules (CRITICAL):",
    "- Cover different sub-skills, not the same skill with new numbers.",
    "- Mix question formats: ~50% multiple_choice, ~25% short_answer, ~25% true_false (unless the user specified).",
    "- Mix difficulty levels even within a single 'medium' quiz.",
    "- Test different shapes: definitions, applications, identify-the-misconception, compare scenarios.",
    "- For multiple choice, distractors should reflect realistic mistakes, not random wrong answers.",
    "- Re-read your set before submitting; replace any near-duplicates.",
  ].join("\n");

  const userPrompt = [
    `Build a ${count}-question practice quiz on this VERY specific topic.`,
    `Subject: ${subjectName || "(none)"}`,
    `Topic: ${opts.topic.trim()}`,
    opts.subtopics.trim()
      ? `Specific subtopics / learning objectives: ${opts.subtopics.trim()}`
      : null,
    `Difficulty: ${opts.difficulty}`,
    "",
    `Title the quiz concisely with the topic. If subject is provided, use that subjectName exactly.`,
  ]
    .filter(Boolean)
    .join("\n");

  const client = getClient();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 6000,
    system: systemPrompt,
    tools: TOOLS.filter((t) => t.name === "create_practice_quiz"),
    tool_choice: { type: "tool", name: "create_practice_quiz" },
    messages: [{ role: "user", content: userPrompt }],
  });

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
  );
  if (!toolUse) {
    return { error: "AI didn't generate a quiz. Try again." };
  }

  const input = toolUse.input as CreateQuizInput;
  if (subjectName && !input.subjectName) input.subjectName = subjectName;

  const result = await executeCreateQuiz(opts.userId, input);
  if ("error" in result) return { error: result.error };
  return {
    quizId: result.quizId,
    quizUrl: result.quizUrl,
    questionCount: input.questions?.length ?? count,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Generate a flashcard deck from a topic
// ─────────────────────────────────────────────────────────────────────────────

const FLASHCARD_DECK_TOOL: Anthropic.Tool = {
  name: "create_flashcard_deck",
  description:
    "Save a flashcard deck the user can study. Build the cards from your knowledge of the topic. Each card should have a tight 'front' (term, question, prompt) and a clear 'back' (definition, answer, explanation).",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      description: {
        type: "string",
        description: "Optional 1-line summary of what's in the deck.",
      },
      cards: {
        type: "array",
        minItems: 2,
        maxItems: 50,
        items: {
          type: "object",
          properties: {
            front: { type: "string" },
            back: { type: "string" },
            hint: { type: "string" },
          },
          required: ["front", "back"],
        },
      },
    },
    required: ["title", "cards"],
  },
};

export async function generateFlashcardDeck(opts: {
  userId: string;
  topic: string;
  subjectId: string | null;
  count: number;
}): Promise<
  | { deckId: string; deckUrl: string; cardCount: number }
  | { error: string }
> {
  if (!opts.topic.trim()) {
    return { error: "Topic is required." };
  }

  let subjectName = "";
  if (opts.subjectId) {
    const subject = await prisma.subject.findUnique({
      where: { id: opts.subjectId },
    });
    if (!subject || subject.userId !== opts.userId) {
      return { error: "Invalid subject." };
    }
    subjectName = subject.name;
  }

  const count = Math.max(4, Math.min(30, Math.round(opts.count)));

  const systemPrompt = [
    "You write study flashcards for students.",
    "Each flashcard MUST have:",
    "- a `front` that is short and clean — a term, question, or prompt (≤140 chars typically).",
    "- a `back` that is a clear, direct answer/definition/explanation. For math/science use LaTeX (e.g. `$E = mc^2$`).",
    "- optional `hint` for things students often forget — keep brief.",
    "Cover the topic broadly: vary card types (definitions, concept-applications, key formulas/dates, common confusions, examples).",
    "Avoid duplicate cards or cards that test the same fact twice.",
    "Output via the create_flashcard_deck tool — DO NOT just describe in text.",
  ].join("\n");

  const userPrompt = [
    `Topic: ${opts.topic.trim()}`,
    subjectName ? `Subject (for context only): ${subjectName}` : null,
    `Build EXACTLY ${count} flashcards on this topic.`,
    `Title the deck appropriately and concisely.`,
  ]
    .filter(Boolean)
    .join("\n");

  const client = getClient();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 6000,
    system: systemPrompt,
    tools: [FLASHCARD_DECK_TOOL],
    tool_choice: { type: "tool", name: "create_flashcard_deck" },
    messages: [{ role: "user", content: userPrompt }],
  });

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
  );
  if (!toolUse) {
    return {
      error: "AI didn't generate a deck. Try a more specific topic.",
    };
  }

  type DeckInput = {
    title?: string;
    description?: string;
    cards?: { front?: string; back?: string; hint?: string }[];
  };
  const input = toolUse.input as DeckInput;
  const cards = (input.cards ?? [])
    .filter((c) => c && c.front && c.back)
    .map((c, i) => ({
      orderIndex: i,
      front: String(c.front).slice(0, 500),
      back: String(c.back).slice(0, 2000),
      hint: c.hint ? String(c.hint).slice(0, 500) : null,
    }));
  if (cards.length === 0) {
    return { error: "AI returned no usable cards." };
  }

  const deck = await prisma.flashcardDeck.create({
    data: {
      userId: opts.userId,
      subjectId: opts.subjectId,
      title: (input.title ?? opts.topic).slice(0, 120),
      description: input.description?.slice(0, 500) ?? null,
      cards: { create: cards },
    },
  });

  return {
    deckId: deck.id,
    deckUrl: `/flashcards/${deck.id}`,
    cardCount: cards.length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Generate a focused review quiz from a list of missed questions
// ─────────────────────────────────────────────────────────────────────────────

export async function generateReviewQuizFromMissed(opts: {
  userId: string;
  sourceQuizId: string;
  questionIds: string[];
}): Promise<
  | { quizId: string; quizUrl: string; title: string; questionCount: number }
  | { error: string }
> {
  const quotaCheck = await canCreateQuiz(opts.userId);
  if (!quotaCheck.allowed) {
    return { error: quotaCheck.reason ?? "Daily quiz limit reached." };
  }

  const sourceQuiz = await prisma.quiz.findUnique({
    where: { id: opts.sourceQuizId },
    include: { subject: true },
  });
  if (!sourceQuiz || sourceQuiz.userId !== opts.userId) {
    return { error: "Source quiz not found." };
  }

  const missedQuestions = await prisma.question.findMany({
    where: { id: { in: opts.questionIds }, quizId: opts.sourceQuizId },
    orderBy: { orderIndex: "asc" },
  });
  if (missedQuestions.length === 0) {
    return { error: "No missed questions to review." };
  }

  const subjectName = sourceQuiz.subject?.name ?? "";

  const questionsBlock = missedQuestions
    .map((q, i) => {
      const opts = q.optionsJson
        ? `\nOptions: ${q.optionsJson}`
        : "";
      return `Question ${i + 1} (${q.type}):\nPrompt: ${q.prompt}${opts}\nCorrect answer: ${q.correctAnswer}${q.explanation ? `\nExplanation: ${q.explanation}` : ""}`;
    })
    .join("\n\n---\n\n");

  const userPrompt = [
    `Subject: ${subjectName || "(unknown)"}`,
    `Source quiz: ${sourceQuiz.title}`,
    "",
    `The student got these ${missedQuestions.length} questions WRONG. Make a focused review quiz to help them learn from these specific mistakes.`,
    "",
    "Decide which strategy fits the subject:",
    "- VERBAL / FACTUAL subjects (English, literature, history, vocabulary, language learning, social studies): use the EXACT same questions verbatim. The student needs to memorize/reinforce the specific content.",
    "- NUMERICAL / COMPUTATIONAL / FORMULA-BASED subjects (math, calculus, physics, chemistry, statistics, programming, engineering): keep the same problem structure and difficulty but VARY the numbers, expressions, or parameters so the student practices the same skill on a fresh problem. Do NOT just rephrase the same wording with the same numbers — actually change the inputs.",
    "- MIXED subjects: use your judgment per question.",
    "",
    "If you vary numerical questions, make sure the new question is solvable with the same approach and the answer you give is the correct answer to the NEW numbers (not the old ones).",
    "",
    `Title the new quiz: "Review: ${sourceQuiz.title}".`,
    `Use the same subjectName ("${subjectName}") if it's set.`,
    `Make exactly ${missedQuestions.length} questions, one per missed question above (same order).`,
    "",
    "Original missed questions:",
    "",
    questionsBlock,
  ].join("\n");

  const systemPrompt = [
    "You write practice questions to help students learn from their mistakes.",
    "Output via the create_practice_quiz tool — DO NOT just describe the questions in text.",
    "For numerical/formula problems, provide LaTeX-formatted prompts when symbols are needed (e.g. `$x^2 + 3x = 0$`).",
    "Each question's `correctAnswer` MUST be correct for that specific question's numbers.",
    "Provide a 1-2 sentence `explanation` for each correct answer.",
  ].join("\n");

  const client = getClient();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 6000,
    system: systemPrompt,
    tools: TOOLS.filter((t) => t.name === "create_practice_quiz"),
    tool_choice: { type: "tool", name: "create_practice_quiz" },
    messages: [{ role: "user", content: userPrompt }],
  });

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
  );
  if (!toolUse) {
    return {
      error:
        "AI didn't generate review questions. Try again in a moment.",
    };
  }

  // Force-set the subjectName so it gets associated correctly.
  const input = toolUse.input as CreateQuizInput;
  if (subjectName && !input.subjectName) input.subjectName = subjectName;

  const result = await executeCreateQuiz(opts.userId, input);
  if ("error" in result) return { error: result.error };
  return {
    quizId: result.quizId,
    quizUrl: result.quizUrl,
    title: input.title ?? `Review: ${sourceQuiz.title}`,
    questionCount: input.questions?.length ?? missedQuestions.length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────────────────────────────────

export async function generateAssistantReply(opts: {
  userId: string;
  userMessage: string;
  userImages: ImageInput[];
  mode?: "normal" | "tutor";
}): Promise<string> {
  const { userId, userMessage, userImages, mode = "normal" } = opts;

  const history = await prisma.chatMessage.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: HISTORY_TURNS,
    select: { role: true, content: true, imagesJson: true },
  });
  history.reverse();

  const messages: Anthropic.MessageParam[] = await Promise.all(
    history.map(async (m) => {
      const imgs = await loadImagesAsBase64(m);
      const blocks: Anthropic.MessageParam["content"] = [];
      for (const img of imgs) {
        blocks.push({
          type: "image",
          source: {
            type: "base64",
            media_type: img.mediaType,
            data: img.data,
          },
        });
      }
      if (m.content.trim().length > 0) {
        blocks.push({ type: "text", text: m.content });
      }
      return {
        role:
          m.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content:
          blocks.length > 0 ? blocks : [{ type: "text" as const, text: "" }],
      };
    })
  );

  const currentBlocks: Anthropic.MessageParam["content"] = [];
  for (const img of userImages) {
    currentBlocks.push({
      type: "image",
      source: {
        type: "base64",
        media_type: img.mediaType,
        data: img.data,
      },
    });
  }
  if (userMessage.trim().length > 0) {
    currentBlocks.push({ type: "text", text: userMessage });
  }
  messages.push({ role: "user", content: currentBlocks });

  let systemPrompt = await buildSystemPrompt(userId);
  if (mode === "tutor") {
    systemPrompt += "\n\n" + TUTOR_MODE_ADDENDUM;
  }
  const client = getClient();

  // Agentic loop: call → if tool_use, execute, append, call again → repeat.
  const toolSummaries: string[] = [];
  const toolLinks: string[] = [];
  let finalText = "";
  let lastStopReason: string | null | undefined = null;

  for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      tools: TOOLS,
      messages,
    });

    lastStopReason = response.stop_reason;
    console.log(
      `[ai] iter ${iter} stop_reason=${response.stop_reason} blocks=${response.content
        .map((b) => b.type)
        .join(",")}`
    );

    // Append assistant turn to history
    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason !== "tool_use") {
      finalText = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      break;
    }

    // Execute every tool_use block in this turn, collect tool_result blocks
    const toolResultBlocks: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      try {
        const exec = await executeTool(userId, block.name, block.input);
        toolSummaries.push(exec.humanSummary);
        if (
          typeof exec.toolResult === "object" &&
          exec.toolResult !== null &&
          "quizUrl" in exec.toolResult &&
          typeof (exec.toolResult as { quizUrl: unknown }).quizUrl === "string"
        ) {
          toolLinks.push(
            `[Open the quiz](${(exec.toolResult as { quizUrl: string }).quizUrl})`
          );
        }
        if (block.name === "create_schedule_items") {
          toolLinks.push(`[View Schedule](/schedule)`);
        }
        toolResultBlocks.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(exec.toolResult),
        });
      } catch (err) {
        console.error(
          `[ai] tool ${block.name} threw:`,
          err instanceof Error ? err.message : err
        );
        const msg = err instanceof Error ? err.message : "Unknown error";
        toolResultBlocks.push({
          type: "tool_result",
          tool_use_id: block.id,
          is_error: true,
          content: `Error: ${msg}`,
        });
      }
    }

    messages.push({ role: "user", content: toolResultBlocks });
  }

  // Synthesize a reply if the AI returned no text after tools ran.
  if (!finalText) {
    if (toolSummaries.length > 0) {
      const linkLine =
        toolLinks.length > 0 ? `\n\n${Array.from(new Set(toolLinks)).join(" · ")}` : "";
      finalText = `Done! ${toolSummaries.join(" ")}${linkLine}`;
    } else if (lastStopReason === "max_tokens") {
      finalText =
        "I ran out of room while writing that. Try asking for a smaller piece — for example, one quiz at a time, or one course at a time.";
    } else {
      finalText = `I tried to help but couldn't complete that (stop_reason: ${lastStopReason ?? "unknown"}). Try rephrasing or breaking it into smaller steps.`;
    }
  }

  return finalText;
}
