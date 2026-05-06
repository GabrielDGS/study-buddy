// Shared per-type styling for schedule items.
// Used by the calendar (ScheduleManager), the dashboard upcoming list,
// and anywhere else schedule items render.

export type ScheduleType = "test" | "quiz" | "assignment" | "study" | string;

export type TypeStyle = {
  solid: string;
  chipBg: string;
  chipText: string;
  chipBorder: string;
  icon: string;
  label: string;
};

export const TYPE_STYLES: Record<string, TypeStyle> = {
  test: {
    solid: "#ef4444", // red-500
    chipBg: "#fee2e2",
    chipText: "#991b1b",
    chipBorder: "#fecaca",
    icon: "📕",
    label: "Test",
  },
  quiz: {
    solid: "#f59e0b", // amber-500
    chipBg: "#fef3c7",
    chipText: "#92400e",
    chipBorder: "#fde68a",
    icon: "✏️",
    label: "Quiz",
  },
  assignment: {
    solid: "#8b5cf6", // violet-500
    chipBg: "#ede9fe",
    chipText: "#5b21b6",
    chipBorder: "#ddd6fe",
    icon: "📋",
    label: "Assignment",
  },
  study: {
    solid: "#3b82f6", // blue-500
    chipBg: "#dbeafe",
    chipText: "#1e40af",
    chipBorder: "#bfdbfe",
    icon: "🎯",
    label: "Study",
  },
};

const FALLBACK_STYLE: TypeStyle = {
  solid: "#94a3b8",
  chipBg: "#f1f5f9",
  chipText: "#334155",
  chipBorder: "#e2e8f0",
  icon: "📌",
  label: "Item",
};

export function styleForType(type: ScheduleType): TypeStyle {
  return TYPE_STYLES[type] ?? { ...FALLBACK_STYLE, label: type };
}
