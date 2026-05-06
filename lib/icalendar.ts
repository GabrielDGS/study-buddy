// iCalendar (RFC 5545) feed generation.
// Outputs a VCALENDAR with one VEVENT per schedule item.

type IcsItem = {
  id: string;
  title: string;
  type: string;
  dueDate: Date;
  estMinutes: number | null;
  notes: string | null;
  status: string;
  subjectName: string | null;
  updatedAt: Date;
};

const TYPE_PREFIX: Record<string, string> = {
  test: "[Test]",
  quiz: "[Quiz]",
  assignment: "[Assignment]",
  study: "[Study]",
};

function formatIcsDate(d: Date): string {
  // YYYYMMDDTHHMMSSZ — UTC, no separators
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}` +
    `${pad(d.getUTCMonth() + 1)}` +
    `${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}` +
    `${pad(d.getUTCMinutes())}` +
    `${pad(d.getUTCSeconds())}Z`
  );
}

function escapeIcsText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "");
}

/**
 * Fold lines longer than 75 octets per RFC 5545. Each continuation begins
 * with a single space (or tab).
 */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let rest = line;
  chunks.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length > 0) {
    chunks.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  return chunks.join("\r\n");
}

export function buildIcsFeed(opts: {
  calendarName: string;
  calendarDescription?: string;
  items: IcsItem[];
}): string {
  const now = new Date();
  const dtstamp = formatIcsDate(now);

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Study Buddy//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(opts.calendarName)}`,
    opts.calendarDescription
      ? `X-WR-CALDESC:${escapeIcsText(opts.calendarDescription)}`
      : "",
  ].filter(Boolean);

  for (const item of opts.items) {
    const start = item.dueDate;
    const durationMinutes =
      item.estMinutes && item.estMinutes > 0 ? item.estMinutes : 30;
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
    const prefix = TYPE_PREFIX[item.type] ?? "[Item]";
    const subjectLabel = item.subjectName ? ` (${item.subjectName})` : "";
    const summary = `${prefix} ${item.title}${subjectLabel}`;
    const descParts: string[] = [];
    if (item.subjectName) descParts.push(`Subject: ${item.subjectName}`);
    descParts.push(`Type: ${item.type}`);
    if (item.estMinutes) descParts.push(`Estimated: ${item.estMinutes} minutes`);
    if (item.status) descParts.push(`Status: ${item.status}`);
    if (item.notes) descParts.push(`\\n${item.notes}`);

    const eventLines = [
      "BEGIN:VEVENT",
      `UID:${item.id}@studybuddy`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${formatIcsDate(start)}`,
      `DTEND:${formatIcsDate(end)}`,
      `LAST-MODIFIED:${formatIcsDate(item.updatedAt)}`,
      `SUMMARY:${escapeIcsText(summary)}`,
      `DESCRIPTION:${escapeIcsText(descParts.join("\\n"))}`,
      `CATEGORIES:${item.type.toUpperCase()}`,
      item.status === "done" ? "STATUS:CONFIRMED" : "STATUS:TENTATIVE",
      "END:VEVENT",
    ];
    for (const l of eventLines) lines.push(l);
  }

  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
