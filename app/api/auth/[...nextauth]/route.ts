import { handlers } from "@/auth";
import { BASE_PATH } from "@/lib/base-path";
import { getSiteUrl } from "@/lib/site-url";
import { resolveAuthOrigin } from "@/lib/auth-origin";
import { cleanEnv } from "@/lib/env-clean";
import { recordAuthError } from "@/lib/auth-diagnostics";
import { NextRequest } from "next/server";

function configuredAuthUrl(): string | null {
  return cleanEnv(process.env.AUTH_URL) || cleanEnv(process.env.NEXTAUTH_URL) || null;
}

/** The origin this request should be treated as, ignoring spoofable headers in production (#206). */
function trustedOrigin(req: NextRequest): string {
  return resolveAuthOrigin({
    configuredUrl: configuredAuthUrl(),
    requestUrl: req.url,
    forwardedProto: req.headers.get("x-forwarded-proto"),
    forwardedHost: req.headers.get("x-forwarded-host"),
    host: req.headers.get("host"),
  });
}

function withNormalizedRequest(req: NextRequest): NextRequest {
  const url = new URL(req.url);
  const origin = new URL(trustedOrigin(req));
  url.protocol = origin.protocol;
  url.host = origin.host;

  // Restore subpath if stripped by Next.js router
  if (BASE_PATH && !url.pathname.startsWith(BASE_PATH)) {
    url.pathname = `${BASE_PATH}${url.pathname}`;
  }

  return new NextRequest(url, req);
}

import { logger } from "@/lib/logger";

/** Generic sign-in failure redirect with diagnostic details (#118). */
function loginErrorRedirect(req: NextRequest, error: unknown): Response {
  recordAuthError(error);
  logger.error("[auth] handler threw exception:", error);
  const redirectUrl = new URL(`${BASE_PATH}/login?error=Configuration`, trustedOrigin(req));
  return Response.redirect(redirectUrl.toString());
}

function normalizeResponse(response: Response): Response {
  const location = response.headers.get("Location");
  if (!location) {
    return response;
  }

  let targetUrl: URL | null = null;
  try {
    targetUrl = new URL(location);
    if (
      BASE_PATH &&
      !targetUrl.pathname.startsWith(BASE_PATH) &&
      (targetUrl.pathname === "/login" || targetUrl.pathname.startsWith("/login/"))
    ) {
      targetUrl.pathname = `${BASE_PATH}${targetUrl.pathname}`;
    }
  } catch {
    if (
      BASE_PATH &&
      location.startsWith("/login") &&
      !location.startsWith(`${BASE_PATH}/login`)
    ) {
      targetUrl = new URL(
        `${BASE_PATH}${location}`,
        new URL(getSiteUrl()).origin,
      );
    }
  }

  const finalLocation = targetUrl ? targetUrl.toString() : location;

  if (location.includes("error=")) {
    // Details were already logged by the Auth.js logger (lib/auth-diagnostics.ts).
    logger.error("[AUTH_REDIRECT_ERROR]", {
      location: finalLocation,
      status: response.status,
    });
  }

  const effectiveLocation = targetUrl ? targetUrl.toString() : finalLocation;

  if (effectiveLocation === location) {
    return response;
  }

  // Use a new Response to avoid "TypeError: immutable" on guarded headers
  const newHeaders = new Headers(response.headers);
  newHeaders.set("Location", effectiveLocation);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

export async function GET(req: NextRequest) {
  try {
    const res = await handlers.GET(withNormalizedRequest(req));
    return normalizeResponse(res);
  } catch (error) {
    return loginErrorRedirect(req, error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const res = await handlers.POST(withNormalizedRequest(req));
    return normalizeResponse(res);
  } catch (error) {
    return loginErrorRedirect(req, error);
  }
}
