import { BASE_PATH } from "./base-path";

/** App origin including basePath (e.g. https://ziki.dev). */
export function getSiteUrl(): string {
  const raw =
    process.env.AUTH_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    (BASE_PATH ? `http://localhost:3001${BASE_PATH}` : "http://localhost:3000");
  return raw.replace(/\/api\/auth\/?$/, "").replace(/\/$/, "");
}

export function absoluteUrl(path: string): string {
  const base = getSiteUrl();
  if (!path || path === "/") return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
