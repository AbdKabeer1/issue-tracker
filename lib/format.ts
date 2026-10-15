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
