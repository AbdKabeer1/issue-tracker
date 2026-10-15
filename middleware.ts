import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import authConfig from "@/auth.config";
import { isLinkPreviewBot } from "@/lib/link-preview";
import { isSuperAdmin } from "@/lib/roles";

/**
 * Edge-only auth wrapper — initialized from auth.config (no Prisma/bcrypt).
 * Importing `@/auth` here balloons the Edge Function past Vercel's 1 MB limit
 * and leaves production stuck on the old getToken middleware (redirect loops).
 */
const { auth } = NextAuth(authConfig);

/** Bug detail paths only — enough for unfurl bots to hit generateMetadata. */
const BUG_DETAIL_PATH = /^\/bugs\/[^/]+\/?$/;

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth?.user;

  const isAuthPage =
    pathname.startsWith("/login") || pathname.startsWith("/signup");
  const isPasswordResetPage =
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password");
  const isBugPreview =
    BUG_DETAIL_PATH.test(pathname) &&
    isLinkPreviewBot(req.headers.get("user-agent"));
  const isPublic =
    isAuthPage ||
    isPasswordResetPage ||
    isBugPreview ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico";

  if (!isLoggedIn && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  // Allow reset links even when a session exists; only bounce login/signup.
  if (isLoggedIn && isAuthPage) {
    const url = req.nextUrl.clone();
    url.pathname = "/bugs";
    return NextResponse.redirect(url);
  }

  // Super-admin only surface (JWT role; page/actions re-check against DB).
  if (isLoggedIn && pathname.startsWith("/admin")) {
    if (!isSuperAdmin(req.auth?.user?.role)) {
      const url = req.nextUrl.clone();
      url.pathname = "/bugs";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};
