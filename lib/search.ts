/**
 * Escapes SQL LIKE / ILIKE wildcard characters (%, _) and the escape character (\)
 * so that user input passed into Prisma `contains` filter is treated as literal text.
 */
export function escapeSearchQuery(query: string): string {
  return query.replace(/[\\%_]/g, "\\$&");
}

/**
 * Normalizes a query parameter value that may be a single string or an array of strings (repeated keys)
 * to a single string value (taking the first occurrence).
 */
export function toSingleQueryParam(
  value: string | string[] | undefined | null,
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value ?? undefined;
}

