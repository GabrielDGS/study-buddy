"use client";

import { useEffect, useRef, useState } from "react";

type Phase = "focus" | "shortBreak" | "longBreak";

const DURATIONS: Record<Phase, number> = {
  focus: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
};

const LABELS: Record<Phase, string> = {
  focus: "Focus",
  shortBreak: "Short break",
  longBreak: "Long break",
};

const COLORS: Record<Phase, string> = {
  focus: "from-brand-500 to-indigo-500",
  shortBreak: "from-emerald-500 to-teal-500",
  longBreak: "from-purple-500 to-pink-500",
};

function format(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function ding() {
  try {
    const ctx = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch {
    /* audio context unavailable; silent */
  }
}

export default function PomodoroTimer({
  compact = false,
  onSessionComplete,
}: {
  compact?: boolean;
  onSessionComplete?: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("focus");
  const [remaining, setRemaining] = useState<number>(DURATIONS.focus);
  const [running, setRunning] = useState(false);
  const [focusCount, setFocusCount] = useState(0);
  const onCompleteRef = useRef(onSessionComplete);

  useEffect(() => {
    onCompleteRef.current = onSessionComplete;
  }, [onSessionComplete]);

  // Tick once per second
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setRemaining((r) => (r > 0 ? r - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  // Transition phases when timer hits 0
  useEffect(() => {
    if (remaining > 0 || !running) return;
    ding();
    if (phase === "focus") {
      const nextCount = focusCount + 1;
      setFocusCount(nextCount);
      // Every 4th focus session → long break
      const nextPhase: Phase = nextCount % 4 === 0 ? "longBreak" : "shortBreak";
      setPhase(nextPhase);
      setRemaining(DURATIONS[nextPhase]);
      onCompleteRef.current?.();
      // Optional desktop notification
      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        new Notification("Focus session complete 🎉", {
          body: `Time for a ${nextPhase === "longBreak" ? "long" : "short"} break.`,
          icon: "/icon",
          tag: "pomodoro",
        });
      }
    } else {
      setPhase("focus");
      setRemaining(DURATIONS.focus);
      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        new Notification("Break's over — back to it 💪", {
          icon: "/icon",
          tag: "pomodoro",
        });
      }
    }
  }, [remaining, running, phase, focusCount]);

  function start() {
    setRunning(true);
  }
  function pause() {
    setRunning(false);
  }
  function reset() {
    setRunning(false);
    setRemaining(DURATIONS[phase]);
  }
  function skipPhase() {
    setRunning(false);
    if (phase === "focus") {
      const nextCount = focusCount + 1;
      setFocusCount(nextCount);
      const nextPhase: Phase = nextCount % 4 === 0 ? "longBreak" : "shortBreak";
      setPhase(nextPhase);
      setRemaining(DURATIONS[nextPhase]);
    } else {
      setPhase("focus");
      setRemaining(DURATIONS.focus);
    }
  }

  const totalForPhase = DURATIONS[phase];
  const progressPct = ((totalForPhase - remaining) / totalForPhase) * 100;

  return (
    <div
      className={`card overflow-hidden ${
        compact ? "p-4" : "p-6"
      } bg-gradient-to-br ${
        phase === "focus"
          ? "from-brand-50/50 to-indigo-50/50 dark:from-brand-950/40 dark:to-indigo-950/40 border-brand-100 dark:border-brand-900"
          : phase === "shortBreak"
            ? "from-emerald-50/50 to-teal-50/50 dark:from-emerald-950/40 dark:to-teal-950/40 border-emerald-100 dark:border-emerald-900"
            : "from-purple-50/50 to-pink-50/50 dark:from-purple-950/40 dark:to-pink-950/40 border-purple-100 dark:border-purple-900"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {LABELS[phase]} · session {focusCount + (phase === "focus" ? 1 : 0)}
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          🍅 × {focusCount}
        </div>
      </div>

      <div
        className={`text-center font-mono font-bold tracking-tight bg-gradient-to-br ${COLORS[phase]} bg-clip-text text-transparent ${
          compact ? "text-5xl" : "text-7xl"
        }`}
      >
        {format(remaining)}
      </div>

      <div className="mt-3 h-2 bg-slate-200/60 dark:bg-slate-700/60 rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${COLORS[phase]} transition-all duration-500`}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="mt-4 flex gap-2 justify-center">
        {running ? (
          <button className="btn-secondary" onClick={pause}>
            ⏸ Pause
          </button>
        ) : (
          <button className="btn-primary" onClick={start}>
            ▶ Start
          </button>
        )}
        <button className="btn-secondary" onClick={reset}>
          ⟳ Reset
        </button>
        <button className="btn-ghost text-sm" onClick={skipPhase}>
          Skip ▶▶
        </button>
      </div>
    </div>
  );
}
