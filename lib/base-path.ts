/**
 * Resolves the deploy basePath.
 * When hosted on a dedicated domain (e.g. issues.zedu.chat) or when explicitly configured,
 * BASE_PATH is empty ("") so the app is served from the root domain.
 * If legacy contributors.zedu.chat subpath hosting is explicitly needed,
 * it can be configured via BASE_PATH / NEXT_PUBLIC_BASE_PATH.
 */
export function resolveBasePath(
  env: Partial<NodeJS.ProcessEnv> = process.env,
): string {
  const explicit = env.NEXT_PUBLIC_BASE_PATH ?? env.BASE_PATH;
  if (explicit !== undefined) {
    const trimmed = explicit.trim();
    if (!trimmed || trimmed === "/") return "";
    return trimmed.startsWith("/")
      ? trimmed.replace(/\/+$/, "")
      : `/${trimmed.replace(/\/+$/, "")}`;
  }

  const siteOrAuthUrl =
    env.AUTH_URL ||
    env.NEXTAUTH_URL ||
    env.NEXT_PUBLIC_SITE_URL ||
    "";

  // Dedicated subdomain: always empty basePath (root domain)
  if (siteOrAuthUrl.includes("issues.zedu.chat")) {
    return "";
  }

  // Legacy URL explicitly referencing /bug-tracker
  if (siteOrAuthUrl.includes("/bug-tracker")) {
    return "/bug-tracker";
  }

  return "";
}

export const BASE_PATH = resolveBasePath();

/**
 * Strips the deploy basePath from a request pathname.
 * Proxy/middleware can see either form (`/bug-tracker/bugs` or `/bugs`),
 * so both must resolve to the app-relative path.
 */
export function toAppPath(pathname: string): string {
  if (BASE_PATH) {
    if (pathname === BASE_PATH) return "/";
    if (pathname.startsWith(`${BASE_PATH}/`)) {
      return pathname.slice(BASE_PATH.length) || "/";
    }
  }
  // Tolerant of legacy /bug-tracker prefix even when hosted at root
  if (pathname === "/bug-tracker") return "/";
  if (pathname.startsWith("/bug-tracker/")) {
    return pathname.slice("/bug-tracker".length) || "/";
  }
  return pathname;
}
