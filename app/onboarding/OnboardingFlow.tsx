"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Subject = {
  name: string;
  color: string;
};

const PALETTE = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#6366f1",
];

function nextColor(index: number) {
  return PALETTE[index % PALETTE.length];
}

export default function OnboardingFlow({
  initialName,
  initialGradeLevel,
  initialSchool,
}: {
  initialName: string;
  initialGradeLevel: string | null;
  initialSchool: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1
  const [name, setName] = useState(initialName);
  const [gradeLevel, setGradeLevel] = useState(initialGradeLevel ?? "");
  const [school, setSchool] = useState(initialSchool ?? "");

  // Step 2
  const [subjects, setSubjects] = useState<Subject[]>([
    { name: "", color: nextColor(0) },
  ]);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function updateSubject(i: number, patch: Partial<Subject>) {
    setSubjects((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s))
    );
  }

  function addSubject() {
    setSubjects((prev) => [
      ...prev,
      { name: "", color: nextColor(prev.length) },
    ]);
  }

  function removeSubject(i: number) {
    setSubjects((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function saveProfile() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          gradeLevel: gradeLevel.trim() || null,
          school: school.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not save profile.");
        setSaving(false);
        return;
      }
      setStep(2);
      setSaving(false);
    } catch {
      setError("Network error. Try again.");
      setSaving(false);
    }
  }

  async function saveSubjects() {
    setError(null);
    const cleaned = subjects
      .map((s) => ({ ...s, name: s.name.trim() }))
      .filter((s) => s.name.length > 0);

    if (cleaned.length === 0) {
      setError("Add at least one subject.");
      return;
    }

    setSaving(true);
    try {
      for (const s of cleaned) {
        const res = await fetch("/api/subjects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: s.name,
            color: s.color,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? "Could not save subjects.");
          setSaving(false);
          return;
        }
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <StepDot active={step >= 1} label="Profile" />
        <div className="flex-1 h-px bg-slate-200" />
        <StepDot active={step >= 2} label="Subjects" />
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Let&apos;s set up your profile</h2>
            <p className="text-sm text-slate-500">
              We&apos;ll use this to personalize your study plan.
            </p>
          </div>
          <div>
            <label className="label" htmlFor="name">
              Your name
            </label>
            <input
              id="name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="grade">
              Grade level (optional)
            </label>
            <input
              id="grade"
              className="input"
              placeholder="e.g. 10th grade, Sophomore, Year 11"
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="school">
              School (optional)
            </label>
            <input
              id="school"
              className="input"
              value={school}
              onChange={(e) => setSchool(e.target.value)}
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </p>
          )}
          <button
            className="btn-primary w-full"
            onClick={saveProfile}
            disabled={saving || name.trim().length === 0}
          >
            {saving ? "Saving…" : "Continue"}
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Add your subjects</h2>
            <p className="text-sm text-slate-500">
              Add the classes you&apos;re taking. You can change these later.
            </p>
          </div>

          <div className="space-y-3">
            {subjects.map((s, i) => (
              <div
                key={i}
                className="rounded-md border border-slate-200 p-3 bg-slate-50"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={s.color}
                    onChange={(e) => updateSubject(i, { color: e.target.value })}
                    className="h-8 w-10 rounded border border-slate-300 cursor-pointer"
                    aria-label="Subject color"
                  />
                  <input
                    className="input"
                    placeholder="Subject name (e.g. Algebra II)"
                    value={s.name}
                    onChange={(e) => updateSubject(i, { name: e.target.value })}
                  />
                  {subjects.length > 1 && (
                    <button
                      type="button"
                      className="btn-ghost text-red-600"
                      onClick={() => removeSubject(i)}
                      aria-label="Remove subject"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="btn-secondary w-full"
            onClick={addSubject}
          >
            + Add another subject
          </button>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary flex-1"
              onClick={() => setStep(1)}
              disabled={saving}
            >
              Back
            </button>
            <button
              type="button"
              className="btn-primary flex-1"
              onClick={saveSubjects}
              disabled={saving}
            >
              {saving ? "Saving…" : "Finish"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StepDot({ active, label }: { active: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`h-2.5 w-2.5 rounded-full ${
          active ? "bg-brand-600" : "bg-slate-300"
        }`}
      />
      <span
        className={`text-xs ${
          active ? "text-slate-900 font-medium" : "text-slate-500"
        }`}
      >
        {label}
      </span>
    </div>
  );
}
