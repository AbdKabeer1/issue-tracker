/**
 * Module-level storage for recent authentication error details.
 *
 * Auth.js deliberately masks error codes like InvalidCheck, MissingSecret, or
 * OAuthCallbackError into generic `?error=Configuration` to prevent client leakage.
 * In production deployment triage, this makes debugging near-impossible.
 *
 * This store intercepts the underlying AuthError via logger.error and allows the
 * route handler to attach a sanitized reason to the redirect query parameters.
 */

interface RecentAuthError {
  timestamp: number;
  message: string;
  type?: string;
  detail?: string;
}

let lastError: RecentAuthError | null = null;

export function recordAuthError(error: unknown) {
  const err = error as {
    name?: string;
    message?: string;
    type?: string;
    cause?: {
      err?: Error;
      message?: string;
    } | Error;
  };

  const causeObj = err?.cause as { err?: Error; message?: string } | undefined;
  const causeErr = causeObj?.err instanceof Error ? causeObj.err.message : undefined;
  const causeMsg = typeof causeObj?.message === "string" ? causeObj.message : undefined;

  const detail =
    causeErr ||
    causeMsg ||
    err?.message ||
    err?.name ||
    "Authentication failure";

  lastError = {
    timestamp: Date.now(),
    message: err?.message || "Unknown error",
    type: err?.type || err?.name,
    detail,
  };

  console.error("[auth:diagnostic] Captured auth error:", {
    type: lastError.type,
    detail: lastError.detail,
    timestamp: new Date(lastError.timestamp).toISOString(),
  });
}

export function popRecentAuthError(maxAgeMs = 15000): string | null {
  if (!lastError) return null;
  const age = Date.now() - lastError.timestamp;
  if (age > maxAgeMs) {
    lastError = null;
    return null;
  }
  const detail = lastError.detail || lastError.message;
  lastError = null;
  return detail;
}
