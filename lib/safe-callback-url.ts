import { toAppPath } from "@/lib/base-path";

/** Same-origin relative paths only — blocks open redirects and normalizes basePath. */
export function safeCallbackUrl(
  value: FormDataEntryValue | string | null | undefined,
  fallback = "/bugs",
): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.includes("\\") ||
    /[\x00-\x1F\x7F]/.test(trimmed)
  ) {
    return fallback;
  }

  try {
    const parsed = new URL(trimmed, "http://dummy.local");
    if (parsed.origin !== "http://dummy.local") {
      return fallback;
    }
  } catch {
    return fallback;
  }

  return toAppPath(trimmed);
}


