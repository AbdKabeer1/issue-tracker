import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * The Zedu tenant and project that the agent platform migration (#423) puts
 * every existing user and issue into. Until issues are scoped to the
 * session's tenant (#425), new issues land here too.
 */
export const ZEDU_SLUG = "zedu";

export type TenantProject = { tenantId: string; projectId: string };

let cached: Promise<TenantProject> | null = null;

/** The Zedu tenant and project ids. Looked up once per process. */
export function defaultTenantProject(
  db: PrismaClient | Prisma.TransactionClient,
): Promise<TenantProject> {
  cached ??= db.project
    .findFirst({
      where: { slug: ZEDU_SLUG, tenant: { slug: ZEDU_SLUG } },
      select: { id: true, tenantId: true },
    })
    .then((project) => {
      if (!project) throw new Error("The Zedu tenant is missing. Run the database migrations.");
      return { tenantId: project.tenantId, projectId: project.id };
    })
    .catch((error: unknown) => {
      // Don't remember a failure; the next call tries again.
      cached = null;
      throw error;
    });
  return cached;
}
