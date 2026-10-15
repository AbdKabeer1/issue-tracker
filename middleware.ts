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
  const pathWithoutBase = pathname.startsWith("/bug-tracker")
    ? pathname.slice("/bug-tracker".length) || "/"
    : pathname;
  const isLoggedIn = !!req.auth?.user;

  const isAuthPage =
    pathWithoutBase.startsWith("/login") || pathWithoutBase.startsWith("/signup");
  const isPasswordResetPage =
    pathWithoutBase.startsWith("/forgot-password") ||
    pathWithoutBase.startsWith("/reset-password");
  const isBugPreview =
    BUG_DETAIL_PATH.test(pathWithoutBase) &&
    isLinkPreviewBot(req.headers.get("user-agent"));
  const isPublic =
    isAuthPage ||
    isPasswordResetPage ||
    isBugPreview ||
    pathWithoutBase.startsWith("/api/auth") ||
    pathWithoutBase.startsWith("/_next") ||
    pathWithoutBase === "/favicon.ico";

  if (!isLoggedIn && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/bug-tracker/login";
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  // Allow reset links even when a session exists; only bounce login/signup.
  if (isLoggedIn && isAuthPage) {
    const url = req.nextUrl.clone();
    url.pathname = "/bug-tracker/bugs";
    return NextResponse.redirect(url);
  }

  // Super-admin only surface (JWT role; page/actions re-check against DB).
  if (isLoggedIn && pathWithoutBase.startsWith("/admin")) {
    if (!isSuperAdmin(req.auth?.user?.role)) {
      const url = req.nextUrl.clone();
      url.pathname = "/bug-tracker/bugs";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};
