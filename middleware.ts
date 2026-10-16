import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import authConfig from "@/auth.config";
import { isLinkPreviewBot } from "@/lib/link-preview";
import {
  isSuperAdmin,
  resolveEffectiveRole,
  ACTIVE_ROLE_COOKIE_NAME,
} from "@/lib/roles";
import { isSuperAdminEmail } from "@/lib/super-admin";
import { BASE_PATH, toAppPath } from "@/lib/base-path";

/**
 * Edge-only auth wrapper — initialized from auth.config (no Prisma/bcrypt).
 * Importing `@/auth` here balloons the Edge Function past Vercel's 1 MB limit
 * and leaves production stuck on the old getToken middleware (redirect loops).
 */
const { auth } = NextAuth(authConfig);

/** Bug detail paths only — enough for unfurl bots to hit generateMetadata. */
const BUG_DETAIL_PATH = /^\/bugs\/[^/]+\/?$/;

export default auth((req) => {
  const pathWithoutBase = toAppPath(req.nextUrl.pathname);
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
    pathWithoutBase.startsWith("/api/health") ||
    pathWithoutBase.startsWith("/_next") ||
    pathWithoutBase === "/favicon.ico";

  if (!isLoggedIn && !isPublic) {
    const url = new URL(`${BASE_PATH}/login`, req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathWithoutBase);
    return NextResponse.redirect(url);
  }

  // Allow reset links even when a session exists; only bounce login/signup.
  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(
      new URL(`${BASE_PATH}/bugs`, req.nextUrl.origin),
    );
  }

  // Super-admin only surface (JWT role; page/actions re-check against DB).
  if (isLoggedIn && pathWithoutBase.startsWith("/admin")) {
    const activeRoleOverride = req.cookies.get(ACTIVE_ROLE_COOKIE_NAME)?.value;
    const isRealSuper =
      isSuperAdmin(req.auth?.user?.role) ||
      isSuperAdminEmail(req.auth?.user?.email);

    const effectiveRole = resolveEffectiveRole({
      isRealSuperAdmin: isRealSuper,
      baseRole: req.auth?.user?.role,
      activeRoleOverride,
    });

    if (!isSuperAdmin(effectiveRole)) {
      return NextResponse.redirect(
        new URL(`${BASE_PATH}/bugs`, req.nextUrl.origin),
      );
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
