import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { isAdmin } from "@/lib/roles";
import { attachmentResponseHeaders } from "@/lib/attachments";

/**
 * Serve an attachment (#215) to signed-in users. Files on a deleted issue
 * are admin-only (like the issue); files not yet linked to anything are only
 * visible to the person who uploaded them.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await requireUser();

  const attachment = await prisma.attachment.findUnique({
    where: { id },
    select: {
      uploaderId: true,
      filename: true,
      contentType: true,
      size: true,
      data: true,
      bug: { select: { isDeleted: true } },
    },
  });

  const notFound = () => NextResponse.json({ error: "File not found" }, { status: 404 });
  if (!attachment) return notFound();
  if (!attachment.bug && attachment.uploaderId !== user.id) return notFound();
  if (attachment.bug?.isDeleted && !isAdmin(user.role)) return notFound();

  return new NextResponse(new Uint8Array(attachment.data), {
    status: 200,
    headers: attachmentResponseHeaders(attachment),
  });
}
