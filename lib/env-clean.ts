/**
 * Sanitizes environment variable strings by stripping accidental wrapping
 * quotes (both single and double quotes) and trimming surrounding whitespace.
 *
 * This prevents common deployment bugs where environment variables pasted into
 * cloud UIs (such as Coolify, Docker, or Vercel) retain quotation marks like:
 * `GOOGLE_CLIENT_SECRET="GOCSPX-..."` or `AUTH_SECRET='xyz'`
 */
export function cleanEnv(val?: string | null): string | undefined {
  if (val === undefined || val === null) return undefined;
  const trimmed = val.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    const unquoted = trimmed.slice(1, -1).trim();
    return unquoted.length > 0 ? unquoted : undefined;
  }
  return trimmed.length > 0 ? trimmed : undefined;
}
