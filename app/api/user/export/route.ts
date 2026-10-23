import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { exportUserData } from "@/lib/user-data-export";

/**
 * Download personal data archive (#571).
 * Returns JSON of issues, comments, votes, and points.
 */
export async function GET() {
  try {
    // #563: requireUser() signals "not signed in" by throwing a redirect, which
    // must reach Next rather than be reported as a 500. It can also fail for
    // real reasons (its session and account lookups hit the database), and those
    // still belong in the JSON error path — so the catch re-throws Next's
    // control-flow errors and reports everything else.
    const user = await requireUser();
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
    // A redirect (or any Next control-flow signal) is not an error: hand it back.
    unstable_rethrow(error);
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
