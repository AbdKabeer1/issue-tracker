import type { Prisma } from "@prisma/client";
import { escapeSearchQuery } from "@/lib/search";

/**
 * Builds Prisma `where` filter for searching users by name or email.
 * Safely escapes SQL LIKE wildcards (%, _) and backslashes.
 */
export function buildUserSearchWhere(
  query?: string | null,
): Prisma.UserWhereInput {
  const trimmed = query?.trim();
  if (!trimmed) {
    return {};
  }

  const escaped = escapeSearchQuery(trimmed);

  return {
    OR: [
      { name: { contains: escaped, mode: "insensitive" } },
      { email: { contains: escaped, mode: "insensitive" } },
    ],
  };
}
