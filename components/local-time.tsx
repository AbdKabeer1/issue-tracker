"use client";

import { useSyncExternalStore } from "react";
import { formatDate } from "@/lib/format";

type LocalTimeProps = {
  date: Date | string;
  className?: string;
};

const emptySubscribe = () => () => {};

function getClientTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Lagos";
  } catch {
    return "Africa/Lagos";
  }
}

function getServerTimeZone(): string {
  return "Africa/Lagos";
}

export function LocalTime({ date, className }: LocalTimeProps) {
  const timeZone = useSyncExternalStore(
    emptySubscribe,
    getClientTimeZone,
    getServerTimeZone,
  );

  const formatted = formatDate(date, timeZone);
  const iso =
    date instanceof Date
      ? date.toISOString()
      : typeof date === "string"
        ? date
        : "";

  return (
    <time dateTime={iso} className={className} suppressHydrationWarning>
      {formatted}
    </time>
  );
}
