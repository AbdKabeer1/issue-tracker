import { revalidateTag, unstable_cache, updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { notificationInTenant, tenantIdForUser } from "@/lib/tenant-context";
import {
  DEFAULT_PLATFORMS,
  RETIRED_PLATFORMS,
  ensureDefaultPlatforms,
} from "@/lib/categories";

/**
 * Cached reads for data that changes only through an admin action (#297, #317).
 *
 * Platforms and issue types were queried on every render of the issues
 * list, the issue page and the report form. They are cached here under a
 * tag and expired by the admin actions that change them, so an edit shows
 * up on the very next request.
 *
 * What's cached is data that's identical for everyone. The one per-user
 * entry is the unread notification count, keyed by user id and expired by
 * every write that changes it.
 *
 * `revalidate` is a backstop, not the mechanism: it bounds how stale an
 * entry can get if something writes these tables outside the actions here
 * (a seed, a manual SQL fix), and on a self-hosted deployment with several
 * instances, where each instance keeps its own cache.
 */

export const TAGS = {
  issueTypes: "lookup:issue-types",
  platforms: "lookup:platforms",
  unread: (userId: string) => `notifications:unread:${userId}`,
} as const;

const LOOKUP_TTL_SECONDS = 300;
const UNREAD_TTL_SECONDS = 60;

export type IssueTypeLookup = {
  id: string;
  name: string;
  description: string | null;
  template: string | null;
  isActive: boolean;
};
export type PlatformLookup = { id: string; name: string; isActive: boolean };

/**
 * Expires a cache tag. In a server action this is `updateTag`, which also
 * makes the action's own re-render read fresh data; anywhere else (a route
 * handler, an `after()` callback) `updateTag` throws, so it falls back to
 * expiring the tag immediately for the next request.
 */
export function expireTag(tag: string): void {
  try {
    updateTag(tag);
  } catch {
    try {
      revalidateTag(tag, { expire: 0 });
    } catch (error) {
      // Outside any request (a script, a test). Nothing to expire.
      console.warn("[lookups] could not expire", tag, error);
    }
  }
}

const readIssueTypes = (): Promise<IssueTypeLookup[]> =>
  prisma.issueType.findMany({
    select: { id: true, name: true, description: true, template: true, isActive: true },
    orderBy: { name: "asc" },
  });

const readPlatforms = (): Promise<PlatformLookup[]> =>
  prisma.category.findMany({
    select: { id: true, name: true, isActive: true },
    orderBy: { name: "asc" },
  });

const cachedIssueTypes = unstable_cache(readIssueTypes, ["lookup", "issue-types", "v2"], {
  tags: [TAGS.issueTypes],
  revalidate: LOOKUP_TTL_SECONDS,
});

const cachedPlatforms = unstable_cache(readPlatforms, ["lookup", "platforms", "v1"], {
  tags: [TAGS.platforms],
  revalidate: LOOKUP_TTL_SECONDS,
});

/** Every issue type, active or not, by name. */
export function getIssueTypes(): Promise<IssueTypeLookup[]> {
  return cachedIssueTypes();
}

/** The issue types a new report can use. */
export async function getActiveIssueTypesCached(): Promise<IssueTypeLookup[]> {
  return (await getIssueTypes()).filter((t) => t.isActive);
}

/**
 * True when the platform list is missing a default or still has a retired
 * one active — the state `ensureDefaultPlatforms` exists to repair.
 */
export function platformsNeedRepair(
  platforms: Pick<PlatformLookup, "name" | "isActive">[],
  retired: readonly string[] = RETIRED_PLATFORMS,
): boolean {
  const names = new Set(platforms.map((p) => p.name));
  if (DEFAULT_PLATFORMS.some((name) => !names.has(name))) return true;
  return platforms.some((p) => p.isActive && retired.includes(p.name));
}

/**
 * Every platform, active or not, by name.
 *
 * The report form used to run `ensureDefaultPlatforms` — three upserts and
 * an update — on every render. Now it runs only when the list actually
 * needs repairing. A render can't expire a cache tag, so after a repair the
 * fresh rows are read directly; the stale entry ages out within the TTL.
 */
export async function getPlatforms(): Promise<PlatformLookup[]> {
  const platforms = await cachedPlatforms();
  if (!platformsNeedRepair(platforms)) return platforms;
  await ensureDefaultPlatforms();
  return readPlatforms();
}

export async function getActivePlatforms(): Promise<Pick<PlatformLookup, "id" | "name">[]> {
  return (await getPlatforms())
    .filter((p) => p.isActive)
    .map(({ id, name }) => ({ id, name }));
}

/**
 * The header badge's unread count (#317). It was a query on every page
 * render; now it's one per user per change.
 */
export function getUnreadCount(userId: string): Promise<number> {
  return unstable_cache(
    async () =>
      prisma.notification.count({
        // #425: the badge counts what the notifications page lists.
        where: { userId, readAt: null, ...notificationInTenant(await tenantIdForUser(prisma, userId)) },
      }),
    ["notifications", "unread", userId],
    { tags: [TAGS.unread(userId)], revalidate: UNREAD_TTL_SECONDS },
  )();
}

export function expireUnreadCounts(userIds: Iterable<string>): void {
  for (const id of new Set(userIds)) expireTag(TAGS.unread(id));
}
