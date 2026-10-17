/**
 * Server-side logging for Auth.js errors.
 *
 * Auth.js masks error codes like InvalidCheck, MissingSecret or
 * OAuthCallbackError as a generic `?error=Configuration`. This hook writes the
 * underlying cause to the server log so failures can still be triaged.
 *
 * It deliberately keeps nothing in memory and never returns the detail to the
 * caller: error text used to be stored in one module-level variable shared by
 * every request and copied into the login redirect as `?reason=`, which leaked
 * internals (database host, file paths) and could show one user's error to
 * another (#118).
 */
export function describeAuthError(error: unknown): { type?: string; detail: string } {
  const err = error as {
    name?: string;
    message?: string;
    type?: string;
    cause?: { err?: Error; message?: string } | Error;
  };

  const causeObj = err?.cause as { err?: Error; message?: string } | undefined;
  const causeErr = causeObj?.err instanceof Error ? causeObj.err.message : undefined;
  const causeMsg = typeof causeObj?.message === "string" ? causeObj.message : undefined;

  return {
    type: err?.type || err?.name,
    detail: causeErr || causeMsg || err?.message || err?.name || "Authentication failure",
  };
}

export function recordAuthError(error: unknown) {
  const { type, detail } = describeAuthError(error);
  console.error("[auth:diagnostic] Captured auth error:", {
    type,
    detail,
    timestamp: new Date().toISOString(),
  });
}
