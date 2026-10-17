import { toAppPath } from "@/lib/base-path";

const DISALLOWED_CALLBACK_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/session-expired",
  "/api/auth",
];

/** Same-origin relative paths only — blocks open redirects, auth loops, and normalizes basePath. */
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

  const normalized = toAppPath(trimmed);

  // Reject auth loops: landing on login/signup/reset after login creates bounce loops (#352)
  if (
    DISALLOWED_CALLBACK_PATHS.some(
      (path) =>
        normalized === path ||
        normalized.startsWith(path + "/") ||
        normalized.startsWith(path + "?"),
    )
  ) {
    return fallback;
  }

  return normalized;
}


