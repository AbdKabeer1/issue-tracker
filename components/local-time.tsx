"use client";

import { useSyncExternalStore } from "react";
import { formatCompactDate, formatDate, getDefaultTimeZone } from "@/lib/format";

type LocalTimeProps = {
  date: Date | string;
  className?: string;
  /** "Oct 24, 5:27 PM" instead of "Oct 24, 2026, 5:27 PM"; the full stamp stays in the tooltip. */
  compact?: boolean;
};

export function getClientTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || getDefaultTimeZone();
  } catch {
    return getDefaultTimeZone();
  }
}

export function getServerTimeZone(): string {
  return getDefaultTimeZone();
}

const emptySubscribe = () => () => {};

export function LocalTime({ date, className, compact = false }: LocalTimeProps) {
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  const timeZone = isClient ? getClientTimeZone() : getServerTimeZone();
  const formatted = formatDate(date, timeZone);
  const iso =
    date instanceof Date && !isNaN(date.getTime())
      ? date.toISOString()
      : typeof date === "string"
        ? date
        : "";

  return (
    <time dateTime={iso} className={className} title={`${formatted} (${timeZone})`}>
      {compact ? formatCompactDate(date, timeZone) : formatted}
    </time>
  );
}

