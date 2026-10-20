import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveSessionUserId } from "@/lib/session-user";
import { consumeRateLimit, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
import { UPLOAD_RATE_LIMIT, checkAttachment } from "@/lib/attachments";
import { pruneUnlinkedUploads } from "@/lib/attachment-retention";

/**
 * Upload one attachment (#215). It's stored unlinked; creating the issue or
 * comment links it. Until then only the uploader can see it.
 */
export async function POST(req: NextRequest) {
  const resolved = await resolveSessionUserId();
  if ("error" in resolved) {
    return NextResponse.json({ error: "Sign in to upload files." }, { status: 401 });
  }
  const userId = resolved.userId;

  if (!(await consumeRateLimit(`upload:${userId}`, UPLOAD_RATE_LIMIT)).allowed) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 });
  }

  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("file");
  } catch {
    return NextResponse.json({ error: "Couldn't read the upload. Try again." }, { status: 400 });
  }
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkAttachment(bytes, file.name);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: 400 });
  }

  const saved = await prisma.attachment.create({
    data: {
      uploaderId: userId,
      filename: check.filename,
      contentType: check.contentType,
      size: bytes.byteLength,
      data: Buffer.from(bytes),
    },
    select: { id: true, filename: true, contentType: true, size: true },
  });
  // #543: uploads that were never attached expire. Best effort: a failed
  // cleanup must not fail the upload that just succeeded.
  await pruneUnlinkedUploads(prisma, { uploaderId: userId }).catch((error: unknown) =>
    console.error("[uploads] cleanup of unlinked uploads failed", error),
  );
  return NextResponse.json(saved, { status: 201 });
}
