/**
 * Escapes SQL LIKE / ILIKE wildcard characters (%, _) and the escape character (\)
 * so that user input passed into Prisma `contains` filter is treated as literal text.
 */
export function escapeSearchQuery(query: string): string {
  return query.replace(/[\\%_]/g, "\\$&");
}
