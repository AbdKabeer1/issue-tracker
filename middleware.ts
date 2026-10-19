import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import authConfig from "@/auth.config";
import { isLinkPreviewBot } from "@/lib/link-preview";
import { BASE_PATH, toAppPath } from "@/lib/base-path";

/**
 * Edge-only auth wrapper — initialized from auth.config (no Prisma/bcrypt).
 * Importing `@/auth` here balloons the Edge Function past Vercel's 1 MB limit
 * and leaves production stuck on the old getToken middleware (redirect loops).
 */
const { auth } = NextAuth(authConfig);

/** Issue detail paths only — enough for unfurl bots to hit generateMetadata. */
const ISSUE_DETAIL_PATH = /^\/(?:issues|bugs)\/[^/]+\/?$/;

export function isPublicPath(
  pathWithoutBase: string,
  userAgent?: string | null,
): boolean {
  const isAuthPage =
    pathWithoutBase.startsWith("/login") || pathWithoutBase.startsWith("/signup");
  const isPasswordResetPage =
    pathWithoutBase.startsWith("/forgot-password") ||
    pathWithoutBase.startsWith("/reset-password");
  const isIssuePreview =
    ISSUE_DETAIL_PATH.test(pathWithoutBase) &&
    isLinkPreviewBot(userAgent);

  return (
    isAuthPage ||
    isPasswordResetPage ||
    isIssuePreview ||
    pathWithoutBase.startsWith("/session-expired") ||
    pathWithoutBase.startsWith("/api/auth") ||
    pathWithoutBase.startsWith("/api/health") ||
    pathWithoutBase.startsWith("/_next") ||
    pathWithoutBase === "/favicon.ico"
  );
}

export default auth((req) => {
  const pathWithoutBase = toAppPath(req.nextUrl.pathname);
  const isLoggedIn = !!req.auth?.user;

  // Seamless backwards compatibility: redirect /bugs and /bugs/* to /issues and /issues/*
  if (pathWithoutBase === "/bugs" || pathWithoutBase.startsWith("/bugs/")) {
    const newPath = pathWithoutBase.replace(/^\/bugs/, "/issues");
    const targetUrl = new URL(
      BASE_PATH ? `${BASE_PATH}${newPath}` : newPath,
      req.nextUrl.origin,
    );
    targetUrl.search = req.nextUrl.search;
    return NextResponse.redirect(targetUrl, 308);
  }
  if (pathWithoutBase.startsWith("/api/bugs/")) {
    const newPath = pathWithoutBase.replace(/^\/api\/bugs\//, "/api/issues/");
    const targetUrl = new URL(
      BASE_PATH ? `${BASE_PATH}${newPath}` : newPath,
      req.nextUrl.origin,
    );
    targetUrl.search = req.nextUrl.search;
    return NextResponse.redirect(targetUrl, 308);
  }

  const isAuthPage =
    pathWithoutBase.startsWith("/login") || pathWithoutBase.startsWith("/signup");
  const isPublic = isPublicPath(pathWithoutBase, req.headers.get("user-agent"));

  if (!isLoggedIn && !isPublic) {
    const url = new URL(
      BASE_PATH ? `${BASE_PATH}/login` : "/login",
      req.nextUrl.origin,
    );
    url.searchParams.set("callbackUrl", pathWithoutBase);
    return NextResponse.redirect(url);
  }

  // Allow reset links even when a session exists; only bounce login/signup.
  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(
      new URL(BASE_PATH ? `${BASE_PATH}/issues` : "/issues", req.nextUrl.origin),
    );
  }

  // /admin role checks live in the pages and actions (requireAdmin /
  // requireSuperAdmin), which read the current role from the database. The
  // JWT role is only refreshed at sign-in, so checking it here bounced newly
  // promoted admins until they signed out and back in (#121).

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
