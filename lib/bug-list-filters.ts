import type { Prisma } from "@prisma/client";
import { severities, statuses } from "@/lib/validations/bug";
import { escapeSearchQuery, toSingleQueryParam } from "@/lib/search";
import {
  defaultSortFor,
  mineFilterWhere,
  parseMineFilter,
  type MineFilter,
} from "@/lib/mine-filter";
import { parseTagFilter, tagTypeIds } from "@/lib/tag-filter";
import { parseBugSort, type BugSortOption } from "@/lib/bugs-sort";

export type RawParams = Record<string, string | string[] | undefined>;

export type TagType = { id: string; name: string };
export type PlatformLike = { id: string };

/** Value of `?platform=` that selects issues with no platform set. */
export const PLATFORM_NONE = "none";

/**
 * The filters behind the issues list, as a Prisma `where` plus the sort.
 *
 * The CSV export has to return exactly what the list is showing, so both
 * read the query string through this rather than each assembling their own
 * conditions and drifting apart.
 */
export type ParsedBugFilters = {
  where: Prisma.BugWhereInput;
  sort: BugSortOption;
  /** The "Show" filter, which also decides the default order (#312). */
  mine: MineFilter | null;
  /** True when the caller asked for deleted issues and is allowed to see them. */
  isDeletedView: boolean;
};

export function parseBugListFilters({
  params,
  userId,
  canSeeDeleted,
  tagTypes = [],
  platforms = [],
}: {
  params: RawParams;
  userId: string | undefined;
  /** Only admins may list deleted issues; everyone else gets the live ones. */
  canSeeDeleted: boolean;
  tagTypes?: readonly TagType[];
  /** Known platforms, so an id that no longer exists falls back to no filter. */
  platforms?: readonly PlatformLike[];
}): ParsedBugFilters {
  const q = toSingleQueryParam(params.q);
  const status = toSingleQueryParam(params.status);
  const severity = toSingleQueryParam(params.severity);
  const deleted = toSingleQueryParam(params.deleted);
  const mine = parseMineFilter(params.mine);

  const isDeletedView = canSeeDeleted && deleted === "true";

  const where: Prisma.BugWhereInput = {
    isDeleted: isDeletedView,
    ...mineFilterWhere(mine, userId),
  };

  const selectedTags = parseTagFilter(params.tags, tagTypes);
  if (selectedTags.length > 0) {
    where.typeId = { in: tagTypeIds(selectedTags, tagTypes) };
  }

  if (status && (statuses as readonly string[]).includes(status)) {
    where.status = status as Prisma.BugWhereInput["status"];
  }
  if (severity && (severities as readonly string[]).includes(severity)) {
    where.severity = severity as Prisma.BugWhereInput["severity"];
  }

  // Platform filter. An id that no longer exists resolves to no filter
  // rather than an empty result, matching what the list does — a bookmark
  // pointing at a deleted platform should show issues, not a blank page.
  const platform = toSingleQueryParam(params.platform);
  if (platform === PLATFORM_NONE) {
    where.categoryId = null;
  } else if (platform && platforms.some((p) => p.id === platform)) {
    where.categoryId = platform;
  }

  if (q?.trim()) {
    const escaped = escapeSearchQuery(q.trim());
    where.OR = [
      { title: { contains: escaped, mode: "insensitive" } },
      { description: { contains: escaped, mode: "insensitive" } },
    ];
  }

  return { where, sort: parseBugSort(toSingleQueryParam(params.sort), defaultSortFor(mine)), mine, isDeletedView };
}
