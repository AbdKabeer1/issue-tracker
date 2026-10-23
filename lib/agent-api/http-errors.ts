import { NextResponse } from "next/server";

export function createMethodNotAllowed(allowed: string[]) {
  return (_req: Request) =>
    NextResponse.json(
      { error: "method_not_allowed", message: `Method not allowed. Allowed: ${allowed.join(", ")}` },
      { status: 405, headers: { Allow: allowed.join(", ") } },
    );
}

export function createOptions(allowed: string[]) {
  return (_req: Request) =>
    new NextResponse(null, {
      status: 204,
      headers: { Allow: allowed.join(", ") },
    });
}
