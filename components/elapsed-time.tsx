"use client";

import { useEffect, useState } from "react";

/** "45s", "12m", "2h 14m", "3d 4h". */
export function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

/**
 * How long since `since`, kept current once a minute. The server render can
 * differ from the client's by a minute; that is expected.
 */
export function ElapsedTime({ since }: { since: Date | string }) {
  const start = typeof since === "string" ? new Date(since) : since;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <time dateTime={start.toISOString()} title={`Working since ${start.toLocaleString()}`} suppressHydrationWarning>
      {formatElapsed(now - start.getTime())}
    </time>
  );
}
