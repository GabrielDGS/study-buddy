# 📚 Study Buddy

> An AI-powered study planner that actually does the work for you — schedules study sessions, generates practice quizzes from any topic, builds flashcard decks on demand, and gently keeps you on track with streaks and reminders.

Built with Next.js 14, TypeScript, Tailwind, Prisma + SQLite, and Anthropic's Claude as a real agent (with tool use, not just chat).

---

## ✨ What it does

### 🤖 AI that actually does things, not just talks
Most "AI study apps" let you chat with an LLM. Study Buddy gives Claude **tools that write to your database**:
- Ask *"Make me a 10-question quiz on integration by substitution"* → it generates the quiz, saves it, and gives you a link.
- Ask *"I have a chemistry test next Friday — add it to my schedule"* → the test goes on your calendar.
- Say *"I missed Monday's study session, fix my schedule"* → it lists what you have, moves missed items to better days, and confirms what changed.
- Drop a photo of your homework → it reads it and walks you through the solution step-by-step.

### 📅 Smart calendar
- Month-grid view of every test, quiz, assignment, and study session, color-coded by type (red tests, amber quizzes, violet assignments, blue study)
- Click a day to see everything on it; check items off when done
- **Calendar sync** — subscribe a unique `.ics` URL from Google / Apple / Outlook so Study Buddy events show up in your main calendar
- Missed sessions surface on the dashboard with a one-click "ask AI to rebalance" CTA

### 📝 Practice — quizzes & flashcards in one place
- **Structured quiz form** that pushes for specific topics + sub-objectives + difficulty (no more "make me a quiz on calculus" → 10 watered-down questions)
- One-question-at-a-time runner with retry logic — three wrong tries auto-reveals the answer
- **Generate review quizzes from your mistakes**: for verbal subjects (English, history), the AI uses the same questions; for math/science, it generates **fresh numerical variants of the same problem shape** so you actually learn the skill
- **Flashcards**: build manually or have the AI generate a topic-focused deck. Flip cards with click/space, navigate with arrow keys

### 🎓 Tutor mode
A toggle in the AI helper. When on, the AI defaults to Socratic guidance — leading questions, one step at a time, hints instead of answers — but you can always say *"show me the full solution"* and it will.

### 🔔 Notifications
- Day-before reminders for upcoming tests, quizzes, and assignments
- Daily summary of items due today
- Streak-at-risk warnings if you haven't checked in by evening
- Falls back to in-app toasts if the OS-level permission is denied

### 🔥 Streaks + gentle gamification
- Sidebar pill shows your consecutive-day streak with 🔥 / 💤 status
- Confetti on quiz completion (triple-burst for a perfect first-try score)
- Stat cards on the dashboard track subjects, upcoming workload, and completion %

### 🧠 Spaced repetition under the hood
Every quiz mistake gets enrolled in an SR queue (1d → 3d → 7d → 14d → 30d intervals). Surfaces in the Practice tab as "mistakes to review" per quiz, ready to be turned into a fresh review session.

### 📱 Mobile + PWA
- Fully responsive: drawer-style sidebar, dot-style calendar cells, touch-friendly inputs
- Installable as a Progressive Web App on Android / iOS / desktop with custom icon, theme color, splash, offline page
- Service worker handles offline navigation gracefully

### 🎨 Plus all the small things
- Real markdown rendering in chat with **KaTeX** for proper math formulas (`$\\int_0^1 f(x)\\,dx$` → renders as math, not gibberish)
- Image attachments in the AI helper (paste from clipboard, click 📎, or drag) — vision-enabled so the AI can read screenshots of homework, syllabi, problem sets
- Per-user daily AI quotas (50 messages/day, 3 quizzes/day) so cost stays predictable
- Email + password authentication with proper password reset flow
- Page transitions, hover/press scale animations, gradient backgrounds — feels like a real app, not a tutorial project

---

## 🛠️ Tech stack

| Layer        | Choice                                                      |
| ------------ | ----------------------------------------------------------- |
| Framework    | **Next.js 14** (App Router) + **TypeScript**                |
| Styling      | **Tailwind CSS** + custom typography plugin                 |
| Database     | **Prisma ORM** + SQLite (swap for Postgres in prod)         |
| Auth         | Custom JWT with bcrypt (httpOnly cookies)                   |
| AI           | **Anthropic Claude Sonnet 4.5** with tool use               |
| Markdown     | `react-markdown` + `remark-gfm` + `remark-math` + `rehype-katex` |
| Animations   | Tailwind keyframes + `canvas-confetti`                      |
| PWA          | Web manifest + service worker + Web Push API                |
| Calendar     | Hand-rolled iCalendar (RFC 5545) feed                       |

---

## 🚀 Setup

### Prerequisites

- **Node.js 18.17+** (or 20+) — install from [nodejs.org](https://nodejs.org/)
- An **Anthropic API key** — sign up at [console.anthropic.com](https://console.anthropic.com/), add a payment method (~$5 minimum), create an API key

### Run it locally

```bash
# 1. Clone the repo
git clone https://github.com/GabrielDGS/study-buddy.git
cd study-buddy

# 2. Install dependencies (also runs prisma generate)
npm install

# 3. Set up environment variables
cp .env.example .env
# Then edit .env and:
#   - Replace JWT_SECRET with a real random string (see command below)
#   - Add your ANTHROPIC_API_KEY

# Generate a strong JWT secret:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 4. Apply the database schema
npx prisma db push

# 5. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), click "Get started", and walk through onboarding.

---

## 🏗️ Architecture highlights

A few things in here might be interesting if you're learning:

### Tool-use agentic loop
The AI doesn't just respond with text — it can call tools (`create_practice_quiz`, `create_schedule_items`, `update_schedule_item`, `generate_flashcard_deck`, etc.) that hit Prisma directly. The chat route runs an iterative loop: send messages → if Claude returns `tool_use` blocks → execute them → send `tool_result` back → repeat until the model emits text. See [`lib/ai.ts`](lib/ai.ts).

### "Smart" review-quiz generation
When you finish a quiz with mistakes, the AI generates a follow-up quiz tailored to the subject:
- **Verbal/factual** subjects (English, history, vocab) → exact same questions for memorization
- **Numerical/computational** subjects (math, physics, programming) → same problem shape, fresh numbers — so you practice the skill, not the specific answer

The detection is built into the prompt; see `generateReviewQuizFromMissed` in `lib/ai.ts`.

### Sandbox-safe env loading
A subtle bug: in some environments the parent shell exports `ANTHROPIC_API_KEY=""` (empty string), which prevents Next.js's dotenv from overriding with the real value in `.env`. The code in `lib/ai.ts` falls back to reading `.env` directly when `process.env.ANTHROPIC_API_KEY` is missing or empty.

### Spaced repetition without dependencies
Levels 0→4 with intervals of 1d / 3d / 7d / 14d / 30d, level 5 graduates the question. No external library — just a `QuestionReview` table and a small scheduler in `lib/spacedRepetition.ts`.

### iCalendar feed
RFC 5545-compliant `.ics` generation in pure TS, served via a token-gated public endpoint so users can subscribe in any calendar app. See `lib/icalendar.ts` + `app/api/calendar/[token]/route.ts`.

### Image storage that won't choke the DB
Chat image attachments go to disk under `data/uploads/<userId>__<random>.jpg`. The DB only stores filenames; an authenticated `/api/images/[filename]` route serves them and validates the userId prefix matches the session. Old base64-in-DB messages still render via a backwards-compatible reader in `lib/imageStore.ts`.

### Quota / rate limiting
Per-user daily quotas (50 messages, 3 quizzes) are enforced at the route level by counting rows since local midnight — no Redis or rate-limiter library needed for a single-instance app.

---

## 📁 Project layout

```
app/
  (auth)/                    Login, signup, forgot-password, reset-password
  (app)/                     Authenticated pages (sidebar layout)
    dashboard/               Stats + upcoming + missed sessions + AI CTA
    schedule/                Calendar grid + day detail + .ics sync
    subjects/                Color-coded subject CRUD
    quizzes/                 Practice tab with Quizzes + Flashcards sub-tabs
    flashcards/[id]/         Single deck study mode
    chat/                    AI helper with tutor mode & image attachments
  api/
    auth/                    signup, login, logout, forgot, reset-password
    chat/                    Main AI route with tool-use loop
    quizzes/                 List + delete + generate-review
    flashcards/              Deck CRUD + AI generation
    schedule/                Item CRUD
    reviews/                 SR scheduling + answers
    notifications/check      Returns notifications to fire today
    calendar/[token]         Public ICS feed
    images/[filename]        Authenticated image serving
  manifest.ts, icon.tsx,     PWA manifest + dynamically-generated icons
  apple-icon.tsx
components/
  AppShell                   Mobile drawer + header + page transitions
  Sidebar, UserMenu, NotificationsClient, ServiceWorkerRegistrar, etc.
lib/
  ai.ts                      Claude client + tool defs + system prompt
  auth.ts                    JWT + cookies + password hashing
  db.ts                      Prisma singleton
  email.ts                   (Stub — logs to console; swap for Resend etc.)
  icalendar.ts               ICS feed generator
  imageStore.ts              Disk-backed image storage
  quota.ts                   Daily AI usage limits
  scheduleStyles.ts          Per-event-type colors
  spacedRepetition.ts        SR scheduler
  streaks.ts                 Daily check-in tracking
  validation.ts              Zod schemas
prisma/
  schema.prisma
public/
  sw.js, offline.html
```

---

## ⚠️ Production notes

This repo is set up to run locally as a single-user / small-group app:

- **SQLite** is fine for personal/dev use but won't survive serverless deploys — swap for Postgres before deploying to Vercel/Fly/Railway.
- **Service worker push** is currently in-app only — for true OS push that works while the app is closed, wire up [Web Push](https://developer.mozilla.org/en-US/docs/Web/API/Push_API) (VAPID keys + push subscription store + cron-driven sender).
- **Email sending** is stubbed in `lib/email.ts` (logs reset links to the console). For real password resets, plug in [Resend](https://resend.com) (free tier 100 emails/day) or any SMTP provider.
- **API key**: never commit `.env`. The repo's `.gitignore` already excludes it.

---

## 📜 License

[MIT](LICENSE) — free for anyone to use, modify, and learn from. Attribution appreciated but not required.
