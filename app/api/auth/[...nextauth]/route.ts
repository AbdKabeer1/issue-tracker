import { handlers } from "@/auth";
import { BASE_PATH } from "@/lib/base-path";
import { NextRequest } from "next/server";

function withBasePath(req: NextRequest) {
  const url = new URL(req.url);
  if (!url.pathname.startsWith(BASE_PATH)) {
    url.pathname = `${BASE_PATH}${url.pathname}`;
    return new NextRequest(url, req);
  }
  return req;
}

export async function GET(req: NextRequest) {
  return handlers.GET(withBasePath(req));
}

export async function POST(req: NextRequest) {
  return handlers.POST(withBasePath(req));
}
