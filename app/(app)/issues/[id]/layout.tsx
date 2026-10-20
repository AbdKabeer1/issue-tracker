import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { viewerBugScope } from "@/lib/tenant-viewer";
import { canDeleteTicket } from "@/lib/ticket-deletion";
import { currentTenantAccess } from "@/lib/tenant-access";

/**
 * Decides 404 before anything streams (#291).
 *
 * This route has a loading.tsx, and a loading boundary makes the route
 * stream: once its shell has been sent the status is fixed at 200, so a
 * notFound() thrown later from the page can no longer produce a 404 — it
 * would render "not found" with a success status. A layout renders outside
 * its own segment's loading boundary, so a check here still controls the
 * status. The page keeps its own checks; this only has to run first.
 */
export default async function IssueLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const bug = await prisma.bug.findUnique({
    where: { id, ...(await viewerBugScope()) },
    select: { isDeleted: true },
  });
  if (!bug) notFound();

  if (bug.isDeleted) {
    // Deleted issues are visible to those who can restore them, and a 404 to
    // everyone else — the same rule the page applies.
    const session = await auth();
    if (!session?.user) notFound();
    const user = await requireUser();
    const access = await currentTenantAccess(user.id, user.role);
    if (!canDeleteTicket(user.role, access.membershipRole)) notFound();
  }

  return children;
}
