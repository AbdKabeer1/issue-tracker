import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth-helpers";
import { isTenantAdmin } from "@/lib/agents/membership";
import { currentTenantIdFor } from "@/lib/tenant-context";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
const STATE_COOKIE = "ziki_github_install_state";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  const installationId = query.get("installation_id") ?? "";
  const state = query.get("state") ?? "";
  const setupAction = query.get("setup_action");
  const jar = await cookies();
  const expected = jar.get(STATE_COOKIE)?.value;
  jar.delete(STATE_COOKIE);
  const slug = expected?.split(".", 1)[0] ?? "";
  const settingsUrl = new URL(`/projects/${encodeURIComponent(slug)}/settings`, request.url);

  if (!expected || state !== expected || !/^[a-z0-9-]{1,48}$/.test(slug) || !/^\d{1,20}$/.test(installationId) || !["install", "update"].includes(setupAction ?? "")) {
    settingsUrl.searchParams.set("github", "error");
    return NextResponse.redirect(settingsUrl);
  }
  const user = await requireUser();
  const tenantId = await currentTenantIdFor(user.id);
  if (!tenantId || !(await isTenantAdmin(user, tenantId))) return NextResponse.redirect(new URL("/issues", request.url));
  const project = await prisma.project.findFirst({ where: { tenantId, slug }, select: { id: true, githubInstallationId: true } });
  if (!project) return NextResponse.redirect(new URL("/projects", request.url));
  await prisma.$transaction(async (tx) => {
    await tx.project.update({ where: { id: project.id }, data: { githubInstallationId: installationId } });
    await tx.projectAuditEvent.create({
      data: {
        tenantId,
        projectId: project.id,
        actorUserId: user.id,
        action: "github.installation.connected",
        changes: { githubInstallationId: { from: project.githubInstallationId, to: installationId } },
      },
    });
  });
  settingsUrl.searchParams.set("github", "connected");
  return NextResponse.redirect(settingsUrl);
}
