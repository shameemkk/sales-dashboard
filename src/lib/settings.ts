const KEYS = {
  defaultCols: "uparrow:default-cols",
  defaultTableDays: "uparrow:default-table-days",
} as const;

export const ALL_COL_KEYS = [
  "date",
  "totalEmailsSent",
  "totalNewLeadsContacted",
  "totalReplies",
  "replyPct",
  "totalPositiveReplies",
  "positivePct",
  "meetingsBooked",
  "bookedPct",
  "markedBooking",
  "meetingsShowUp",
  "showUpPct",
  "meetingsClosed",
  "closedPct",
  "meetingsNoShow",
  "noShowPct",
  "meetingsDisqualified",
  "meetingsCanceled",
  "meetingsRescheduled",
] as const;

export function getDefaultCols(): Set<string> {
  try {
    const stored = localStorage.getItem(KEYS.defaultCols);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return new Set(parsed);
    }
  } catch {}
  return new Set(ALL_COL_KEYS);
}

export function saveDefaultCols(cols: Set<string>): void {
  localStorage.setItem(KEYS.defaultCols, JSON.stringify([...cols]));
}

export function getDefaultTableDays(): number {
  try {
    const stored = localStorage.getItem(KEYS.defaultTableDays);
    if (stored) {
      const n = parseInt(stored, 10);
      if (!isNaN(n) && n > 0) return n;
    }
  } catch {}
  return 7;
}

export function saveDefaultTableDays(days: number): void {
  localStorage.setItem(KEYS.defaultTableDays, String(days));
}
