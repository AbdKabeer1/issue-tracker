"use client";

import { formatRelativeTime } from "@/lib/format";

type RelativeTimeProps = {
  date: Date | string;
  className?: string;
};

export function RelativeTime({ date, className }: RelativeTimeProps) {
  const formatted = formatRelativeTime(date);
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
