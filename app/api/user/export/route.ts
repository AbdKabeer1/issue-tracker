import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { exportUserData } from "@/lib/user-data-export";

/**
 * Download personal data archive (#571).
 * Returns JSON of issues, comments, votes, and points.
 */
export async function GET() {
  // #563: requireUser() signals "not signed in" by throwing a redirect. Resolve
  // it outside the try so that redirect reaches Next instead of being caught
  // and reported as a 500 for what is an ordinary signed-out request.
  const user = await requireUser();

  try {
    const data = await exportUserData(prisma, user.id);

    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="data-export-${user.id}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[api/user/export] Export failed:", error);
    return new NextResponse(
      JSON.stringify({ error: "Failed to export user data" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
