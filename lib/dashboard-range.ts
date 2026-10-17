/**
 * The date range behind the dashboard, kept in the URL as `?from=&to=`.
 *
 * Everything here is pure so the parsing can be tested without a database
 * and without waiting for a particular day to arrive.
 */

export const RANGE_PRESETS = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 365, label: "12 months" },
] as const;

export const DEFAULT_RANGE_DAYS = 90;

/** A year is as far back as one page of weekly buckets stays readable. */
export const MAX_RANGE_DAYS = 366;

export type DateRange = {
  /** Inclusive start, at 00:00 UTC. */
  from: Date;
  /** Exclusive end, at 00:00 UTC the day after the last day shown. */
  to: Date;
  days: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

/** Parses a YYYY-MM-DD value, or null if it is not one. */
export function parseDateParam(raw: unknown): Date | null {
  if (typeof raw !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  // Rejects 2026-02-31, which Date would otherwise roll into March.
  if (
    date.getUTCFullYear() !== Number(y) ||
    date.getUTCMonth() !== Number(m) - 1 ||
    date.getUTCDate() !== Number(d)
  ) {
    return null;
  }
  return date;
}

export function formatDateParam(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * The range to report on. Both ends are optional; anything missing, invalid,
 * inverted or too wide falls back to the default rather than erroring, so a
 * hand-edited URL shows a sensible page instead of a stack trace.
 */
export function parseDateRange(
  params: { from?: unknown; to?: unknown },
  now = new Date(),
): DateRange {
  const today = startOfUtcDay(now);
  const defaultFrom = new Date(today.getTime() - (DEFAULT_RANGE_DAYS - 1) * DAY_MS);

  let from = parseDateParam(params.from) ?? defaultFrom;
  let lastDay = parseDateParam(params.to) ?? today;

  // A range the user typed backwards is read as the range they meant.
  if (from > lastDay) [from, lastDay] = [lastDay, from];

  // The end is exclusive, so the last day asked for is fully included.
  const to = new Date(lastDay.getTime() + DAY_MS);

  let days = Math.round((to.getTime() - from.getTime()) / DAY_MS);
  if (days > MAX_RANGE_DAYS) {
    from = new Date(to.getTime() - MAX_RANGE_DAYS * DAY_MS);
    days = MAX_RANGE_DAYS;
  }

  return { from, to, days };
}

/** The range for a preset button, ending today. */
export function presetRange(days: number, now = new Date()): DateRange {
  const today = startOfUtcDay(now);
  const to = new Date(today.getTime() + DAY_MS);
  return { from: new Date(to.getTime() - days * DAY_MS), to, days };
}

/** True when a range is the given preset, for marking the active button. */
export function isPreset(range: DateRange, days: number, now = new Date()): boolean {
  const preset = presetRange(days, now);
  return (
    range.from.getTime() === preset.from.getTime() &&
    range.to.getTime() === preset.to.getTime()
  );
}

/** "3 days" / "1 hour" / "45 minutes", or null when there is no figure. */
export function formatDuration(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return null;
  const units: [number, string][] = [
    [86400, "day"],
    [3600, "hour"],
    [60, "minute"],
  ];
  for (const [size, name] of units) {
    if (seconds >= size) {
      const value = Math.round((seconds / size) * 10) / 10;
      return `${value} ${value === 1 ? name : `${name}s`}`;
    }
  }
  return "under a minute";
}
