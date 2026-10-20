import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth-helpers";
import { isTenantAdmin } from "@/lib/agents/membership";
import { currentTenantIdFor } from "@/lib/tenant-context";
import { prisma } from "@/lib/prisma";
import { appCookieOptions } from "@/lib/cookie-options";

export const runtime = "nodejs";
const STATE_COOKIE = "ziki_github_install_state";

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const settingsUrl = new URL(`/projects/${encodeURIComponent(slug)}/settings`, request.url);
  const appSlug = process.env.GITHUB_APP_SLUG?.trim();
  if (!appSlug || !/^[A-Za-z0-9-]+$/.test(appSlug)) {
    settingsUrl.searchParams.set("github", "unavailable");
    return NextResponse.redirect(settingsUrl);
  }
  const user = await requireUser();
  const tenantId = await currentTenantIdFor(user.id);
  if (!tenantId || !(await isTenantAdmin(user, tenantId))) return NextResponse.redirect(new URL("/issues", request.url));
  const project = await prisma.project.findFirst({ where: { tenantId, slug }, select: { id: true } });
  if (!project) return NextResponse.redirect(new URL("/projects", request.url));

  const state = `${slug}.${randomBytes(24).toString("base64url")}`;
  (await cookies()).set(STATE_COOKIE, state, appCookieOptions(600));
  const installUrl = new URL(`https://github.com/apps/${encodeURIComponent(appSlug)}/installations/new`);
  installUrl.searchParams.set("state", state);
  return NextResponse.redirect(installUrl);
}
