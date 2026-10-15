import { toAppPath } from "@/lib/base-path";

/** Same-origin relative paths only — blocks open redirects and normalizes basePath. */
export function safeCallbackUrl(
  value: FormDataEntryValue | string | null | undefined,
  fallback = "/bugs",
): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;
  return toAppPath(trimmed);
}

