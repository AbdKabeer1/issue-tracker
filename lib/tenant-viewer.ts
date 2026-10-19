import { cache } from "react";
import { resolveSessionUserId } from "@/lib/session-user";
import { bugInTenant, currentTenantIdFor, type TenantScope } from "@/lib/tenant-context";

/**
 * Scope for pages a link-preview bot may open without a session (#117). A
 * signed-in person is scoped to their tenant. Without a session there is no
 * filter: those pages show only an issue's title and status.
 */
export const viewerBugScope = cache(async (): Promise<Partial<TenantScope>> => {
  const resolved = await resolveSessionUserId();
  if (!("userId" in resolved)) return {};
  return bugInTenant(await currentTenantIdFor(resolved.userId));
});
