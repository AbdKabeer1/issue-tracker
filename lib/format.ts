const defaultTz =
  process.env.TZ || process.env.DEFAULT_TIMEZONE || "Africa/Lagos";

export function formatDate(value: Date | string, timeZone?: string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: timeZone || defaultTz,
  }).format(date);
}

export function formatRelativeTime(value: Date | string, now = new Date()): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const elapsedMs = Math.max(0, now.getTime() - date.getTime());
  const seconds = Math.floor(elapsedMs / 1000);
  if (seconds < 60) {
    return "just now";
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
