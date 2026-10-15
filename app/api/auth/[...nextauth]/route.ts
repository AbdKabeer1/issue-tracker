import { handlers } from "@/auth";
import { BASE_PATH } from "@/lib/base-path";
import { NextRequest } from "next/server";

function withNormalizedRequest(req: NextRequest): NextRequest {
  const url = new URL(req.url);

  // Normalize protocol from reverse proxy (Traefik/Coolify SSL termination)
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const isLocal =
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "0.0.0.0";
  const proto = forwardedProto || (isLocal ? "http" : "https");
  url.protocol = `${proto}:`;

  // Normalize host from reverse proxy
  const forwardedHost = req.headers.get("x-forwarded-host");
  const host = forwardedHost || req.headers.get("host") || url.host;
  url.host = host;

  // Clear internal container port if behind public reverse proxy
  if (
    url.protocol === "https:" &&
    (url.port === "3000" || url.port === "3001")
  ) {
    url.port = "";
  }
  if (forwardedHost && !forwardedHost.includes(":")) {
    url.port = "";
  }

  // Restore subpath if stripped by Next.js router
  if (!url.pathname.startsWith(BASE_PATH)) {
    url.pathname = `${BASE_PATH}${url.pathname}`;
  }

  return new NextRequest(url, req);
}

function normalizeResponse(response: Response): Response {
  const location = response.headers.get("Location");
  if (location) {
    try {
      const target = new URL(location);
      if (
        !target.pathname.startsWith(BASE_PATH) &&
        (target.pathname === "/login" || target.pathname.startsWith("/login/"))
      ) {
        target.pathname = `${BASE_PATH}${target.pathname}`;
        response.headers.set("Location", target.toString());
      }
    } catch {
      if (
        location.startsWith("/login") &&
        !location.startsWith(`${BASE_PATH}/login`)
      ) {
        response.headers.set("Location", `${BASE_PATH}${location}`);
      }
    }

    if (location.includes("error=")) {
      console.error("[AUTH_REDIRECT_ERROR]", {
        location: response.headers.get("Location"),
        status: response.status,
      });
    }
  }
  return response;
}

export async function GET(req: NextRequest) {
  const res = await handlers.GET(withNormalizedRequest(req));
  return normalizeResponse(res);
}

export async function POST(req: NextRequest) {
  const res = await handlers.POST(withNormalizedRequest(req));
  return normalizeResponse(res);
}


