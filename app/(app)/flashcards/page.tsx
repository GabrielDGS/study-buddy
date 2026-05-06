import { redirect } from "next/navigation";

// Flashcards live inside the Practice tab now. Anything that still links
// to /flashcards lands here and gets redirected.
export default function FlashcardsRedirect() {
  redirect("/quizzes?tab=flashcards");
}
