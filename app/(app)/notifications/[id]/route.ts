import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveSessionUserId } from "@/lib/session-user";
import { BASE_PATH } from "@/lib/base-path";
import { safeNotificationPath } from "@/lib/notification-links";
import { expireTag, TAGS } from "@/lib/lookups";
import { memberTenantById, readActiveTenantCookie, setActiveTenantCookie } from "@/lib/tenants";
import { setActiveProjectCookie } from "@/lib/project-context";

/**
 * Opening a notification marks it read and goes to what it's about (#216).
 * A plain link, so it works without JavaScript and from a new tab.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const resolved = await resolveSessionUserId();
  const toApp = (path: string) => new URL(`${BASE_PATH}${path}`, req.nextUrl.origin);

  if ("error" in resolved) {
    return NextResponse.redirect(toApp("/login"));
  }

  const notification = await prisma.notification.findUnique({
    where: { id },
    select: { userId: true, tenantId: true, url: true, readAt: true },
  });
  // Someone else's notification (or none): don't reveal or touch it.
  if (!notification || notification.userId !== resolved.userId) {
    return NextResponse.redirect(toApp("/notifications"));
  }

  if (notification.tenantId) {
    const tenant = await memberTenantById(prisma, resolved.userId, notification.tenantId);
    if (!tenant) return NextResponse.redirect(toApp("/notifications"));
    if ((await readActiveTenantCookie()) !== tenant.id) {
      await setActiveTenantCookie(tenant.id);
      await setActiveProjectCookie("");
    }
  }

  if (!notification.readAt) {
    await prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
    expireTag(TAGS.unread(resolved.userId));
  }
  return NextResponse.redirect(toApp(safeNotificationPath(notification.url)));
}
