import { randomInt } from "node:crypto";
import { cookies } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import type { MembershipRole, Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { isSuperAdmin, type AppRole } from "@/lib/roles";
import { ZEDU_SLUG } from "@/lib/tenant";

/**
 * Picking, creating and owning tenants (#444).
 *
 * After sign-in a person works inside one tenant: one they already belong
 * to, one they create, or one they were invited to (lib/invites.ts). A
 * membership is the only way in. Nothing here adds anyone to a tenant except
 * its creator, and there is no joining by name or slug.
 *
 * The tenant picked on this device lives in a cookie, like the active project
 * (#426). It is only a hint: lib/tenant-context.ts checks it against the
 * person's memberships on every request, so a stale or forged id falls back.
 */

type Db = PrismaClient | Prisma.TransactionClient;

export const ACTIVE_TENANT_COOKIE = "ziki_active_tenant";
export const ACTIVE_TENANT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const TENANT_NAME_MIN = 2;
export const TENANT_NAME_MAX = 60;
export const TENANT_SLUG_MAX = 48;

/** Creating tenants is rare; this only stops a script from filling the table. */
export const CREATE_TENANT_RATE_LIMIT = { max: 5, windowMs: 60 * 60 * 1000 };

export const MEMBERSHIP_ROLE_LABELS: Record<MembershipRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

export type TenantChoice = {
  id: string;
  slug: string;
  name: string;
  /** The person's role in this tenant. */
  role: MembershipRole;
};

const tenantChoiceSelect = {
  role: true,
  tenant: { select: { id: true, slug: true, name: true } },
} as const;

function toChoice(membership: {
  role: MembershipRole;
  tenant: { id: string; slug: string; name: string };
}): TenantChoice {
  return { ...membership.tenant, role: membership.role };
}

// ---------------------------------------------------------------------------
// The tenant picked on this device
// ---------------------------------------------------------------------------

export async function readActiveTenantCookie(): Promise<string | null> {
  try {
    return (await cookies()).get(ACTIVE_TENANT_COOKIE)?.value || null;
  } catch (error) {
    // Let Next see its own signals (e.g. "this page is dynamic").
    unstable_rethrow(error);
    // Tests and scripts have no cookie jar: nothing is picked.
    return null;
  }
}

/** Remember the tenant on this device. Callers check the membership first. */
export async function setActiveTenantCookie(tenantId: string): Promise<void> {
  (await cookies()).set(ACTIVE_TENANT_COOKIE, tenantId, {
    path: "/",
    maxAge: ACTIVE_TENANT_COOKIE_MAX_AGE,
    sameSite: "lax",
    httpOnly: true,
  });
}

// ---------------------------------------------------------------------------
// The person's tenants, and where they land
// ---------------------------------------------------------------------------

/** Only the tenants the person belongs to, by name. Never anyone else's. */
export async function tenantsForUser(db: Db, userId: string): Promise<TenantChoice[]> {
  try {
    const memberships = await db.membership.findMany({
      where: { userId },
      select: tenantChoiceSelect,
      orderBy: { tenant: { name: "asc" } },
    });
    return memberships.map(toChoice);
  } catch (error) {
    console.error("[tenants] tenantsForUser failed", error);
    return [];
  }
}

/**
 * Where the home page sends a signed-in person:
 *
 * - one membership: straight into it, never the picker;
 * - several, and one of them picked on this device: into that one;
 * - several and none picked, or none at all: the picker, where they can
 *   choose, create a tenant, or accept an invite.
 */
export function landingPath(
  memberTenantIds: ReadonlyArray<string>,
  pickedTenantId: string | null,
): "/issues" | "/tenants" {
  if (memberTenantIds.length === 1) return "/issues";
  if (pickedTenantId && memberTenantIds.includes(pickedTenantId)) return "/issues";
  return "/tenants";
}

export async function homePathFor(db: Db, userId: string): Promise<"/issues" | "/tenants"> {
  try {
    const memberships = await db.membership.findMany({
      where: { userId },
      select: { tenantId: true },
    });
    return landingPath(
      memberships.map((m) => m.tenantId),
      await readActiveTenantCookie(),
    );
  } catch (error) {
    console.error("[tenants] homePathFor failed", error);
    return "/issues";
  }
}

/** A tenant the person belongs to, by id. Null for any other id. */
export async function memberTenantById(
  db: Db,
  userId: string,
  tenantId: string,
): Promise<TenantChoice | null> {
  if (!tenantId) return null;
  try {
    const membership = await db.membership.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
      select: tenantChoiceSelect,
    });
    return membership ? toChoice(membership) : null;
  } catch (error) {
    console.error("[tenants] memberTenantById failed", error);
    return null;
  }
}

/**
 * A tenant the person belongs to, by slug. A tenant that exists but isn't
 * theirs gets the same `null` as one that doesn't exist, and its name is
 * never read: guessing slugs reveals nothing.
 */
export async function memberTenantBySlug(
  db: Db,
  userId: string,
  slug: string,
): Promise<TenantChoice | null> {
  if (!isTenantSlug(slug)) return null;
  const membership = await db.membership.findFirst({
    where: { userId, tenant: { slug } },
    select: tenantChoiceSelect,
  });
  return membership ? toChoice(membership) : null;
}

// ---------------------------------------------------------------------------
// Creating a tenant
// ---------------------------------------------------------------------------

const collapse = (value: string) => value.replace(/\s+/g, " ").trim();
const hasControlChars = (value: string) => /[\u0000-\u001f\u007f]/.test(value);

/** Names are shown in the header and the picker: short, readable, one line. */
function nameRules(label: string, { optional = false } = {}) {
  return z
    .string()
    .refine(
      (value) => (optional && value === "") || value.length >= TENANT_NAME_MIN,
      `${label} must be at least ${TENANT_NAME_MIN} characters.`,
    )
    .refine(
      (value) => value.length <= TENANT_NAME_MAX,
      `${label} must be ${TENANT_NAME_MAX} characters or fewer.`,
    )
    .refine((value) => !hasControlChars(value), `${label} can't contain control characters.`);
}

export const createTenantSchema = z.object({
  name: z.string().transform(collapse).pipe(nameRules("Tenant name")),
  /** Optional: when left blank the first project is named after the tenant. */
  projectName: z
    .string()
    .optional()
    .transform((value) => collapse(value ?? ""))
    .pipe(nameRules("Project name", { optional: true })),
});

/** Slugs that would collide with the routes under /tenants. */
const RESERVED_TENANT_SLUGS: ReadonlySet<string> = new Set(["invite", "new"]);

export function isTenantSlug(value: string): boolean {
  return value.length <= TENANT_SLUG_MAX && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

/**
 * A URL-safe slug from a display name, by the same rules as project slugs
 * (#426): accents dropped, lower case, runs of anything else become "-".
 */
export function slugFromName(name: string, fallback: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, TENANT_SLUG_MAX)
    .replace(/-+$/g, "");
  return slug || fallback;
}

const SUFFIX_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

function randomSuffix(): string {
  let suffix = "";
  for (let i = 0; i < 4; i++) suffix += SUFFIX_ALPHABET[randomInt(SUFFIX_ALPHABET.length)];
  return suffix;
}

/**
 * The slug to try on each attempt: the name's own slug first, then that slug
 * with a random tail. Random rather than "-2", "-3", ..., so the slug a
 * creator gets says nothing about how many tenants share their name.
 */
export function tenantSlugCandidate(
  base: string,
  attempt: number,
  suffix: () => string = randomSuffix,
): string {
  if (attempt === 0 && !RESERVED_TENANT_SLUGS.has(base)) return base;
  const tail = `-${suffix()}`;
  return `${base.slice(0, TENANT_SLUG_MAX - tail.length).replace(/-+$/g, "")}${tail}`;
}

const SLUG_ATTEMPTS = 5;

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

export type CreateTenantResult =
  | {
      ok: true;
      tenant: { id: string; slug: string; name: string };
      projectId: string;
    }
  | { ok: false; error: string; field?: "name" | "projectName" };

/**
 * Creates a tenant with the creator as its owner, and its first project.
 *
 * Projects have no owner of their own: the tenant's owner owns every project
 * in it. One nested create, so a tenant never exists without its owner or
 * without a project for its first issue.
 */
export async function createTenant(
  db: Db,
  creator: { id: string },
  input: { name?: unknown; projectName?: unknown },
  suffix: () => string = randomSuffix,
): Promise<CreateTenantResult> {
  const parsed = createTenantSchema.safeParse({
    name: typeof input.name === "string" ? input.name : "",
    projectName: typeof input.projectName === "string" ? input.projectName : undefined,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: issue?.message ?? "Check the tenant's name.",
      field: issue?.path[0] === "projectName" ? "projectName" : "name",
    };
  }

  const { name } = parsed.data;
  const projectName = parsed.data.projectName || name;
  const base = slugFromName(name, "tenant");

  for (let attempt = 0; attempt < SLUG_ATTEMPTS; attempt++) {
    const slug = tenantSlugCandidate(base, attempt, suffix);
    try {
      const tenant = await db.tenant.create({
        data: {
          slug,
          name,
          memberships: { create: { userId: creator.id, role: "owner" } },
          projects: { create: { slug: slugFromName(projectName, "project"), name: projectName } },
          // Same three names as DEFAULT_PLATFORMS. Inlined so this file does not
          // import lib/categories, which reads the active tenant from here.
          categories: {
            create: (["Desktop", "Web", "Mobile"] as const).map((name) => ({ name, isActive: true })),
          },
        },
        select: { id: true, slug: true, name: true, projects: { select: { id: true } } },
      });
      const projectId = tenant.projects[0]?.id;
      if (!projectId) throw new Error("A new tenant was created without its first project.");
      return { ok: true, tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name }, projectId };
    } catch (error) {
      // Only the slug is unique on a brand-new tenant: try another one.
      if (isUniqueViolation(error)) continue;
      throw error;
    }
  }
  return { ok: false, error: "Couldn't create that tenant. Try a different name.", field: "name" };
}

// ---------------------------------------------------------------------------
// Zedu's first owner
// ---------------------------------------------------------------------------

/**
 * Everyone moved into Zedu by the migration is a member, never an owner
 * (#423), so nobody could invite anyone. The site's super admin picks the
 * first owner from Zedu's existing members. This never adds anyone to Zedu,
 * and once Zedu has an owner the super admin has no say here.
 */
export async function zeduNeedsOwner(db: Db): Promise<boolean> {
  const zedu = await db.tenant.findUnique({ where: { slug: ZEDU_SLUG }, select: { id: true } });
  if (!zedu) return false;
  const owners = await db.membership.count({ where: { tenantId: zedu.id, role: "owner" } });
  return owners === 0;
}

const memberEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter the member's email address."));

export type PromoteOwnerResult =
  | { ok: true; name: string }
  | { ok: false; error: string; field?: "email" };

export async function promoteFirstZeduOwner(
  db: Db,
  actor: { role?: AppRole | null },
  email: unknown,
): Promise<PromoteOwnerResult> {
  if (!isSuperAdmin(actor.role)) {
    return { ok: false, error: "Only the site's super admin can choose Zedu's first owner." };
  }
  const parsed = memberEmailSchema.safeParse(typeof email === "string" ? email : "");
  if (!parsed.success) {
    return { ok: false, error: "Enter the member's email address.", field: "email" };
  }

  const zedu = await db.tenant.findUnique({ where: { slug: ZEDU_SLUG }, select: { id: true } });
  if (!zedu) return { ok: false, error: "There's no Zedu tenant yet. Run the database migrations." };

  const owners = await db.membership.count({ where: { tenantId: zedu.id, role: "owner" } });
  if (owners > 0) return { ok: false, error: "Zedu already has an owner." };

  const membership = await db.membership.findFirst({
    where: { tenantId: zedu.id, user: { email: { equals: parsed.data, mode: "insensitive" } } },
    select: { id: true, user: { select: { name: true } } },
  });
  if (!membership) {
    return { ok: false, error: "Nobody in Zedu has that email. Only an existing member can be made owner.", field: "email" };
  }

  await db.membership.update({ where: { id: membership.id }, data: { role: "owner" } });
  return { ok: true, name: membership.user.name };
}
