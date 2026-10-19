/**
 * Resolves the deploy basePath.
 * When hosted on a dedicated domain (ziki.dev, or the old issues.zedu.chat) or when explicitly configured,
 * BASE_PATH is empty ("") so the app is served from the root domain.
 * If legacy contributors.zedu.chat subpath hosting is explicitly needed,
 * it can be configured via BASE_PATH / NEXT_PUBLIC_BASE_PATH.
 */
/** Hosts that serve the app from the root, canonical first. */
export const ROOT_DOMAIN_HOSTS = ["ziki.dev", "issues.zedu.chat"] as const;

export function resolveBasePath(
  input?: string | Partial<NodeJS.ProcessEnv>,
): string {
  if (typeof input === "string") {
    const trimmed = input.trim().replace(/\/+$/, "");
    if (trimmed === "" || trimmed === "/") return "";
    return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  }

  const env = input ?? process.env;
  const explicit = env.NEXT_PUBLIC_BASE_PATH ?? env.BASE_PATH;
  if (explicit !== undefined) {
    const trimmed = explicit.trim().replace(/\/+$/, "");
    if (trimmed === "" || trimmed === "/") return "";
    return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  }

  const siteOrAuthUrl =
    env.AUTH_URL ||
    env.NEXTAUTH_URL ||
    env.NEXT_PUBLIC_SITE_URL ||
    "";

  // Dedicated domains: always empty basePath (root domain). ziki.dev is
  // canonical (#424); issues.zedu.chat still serves existing links.
  if (ROOT_DOMAIN_HOSTS.some((host) => siteOrAuthUrl.includes(host))) {
    return "";
  }

  // Legacy URL explicitly referencing contributors.zedu.chat/bug-tracker
  if (siteOrAuthUrl.includes("contributors.zedu.chat/bug-tracker")) {
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
