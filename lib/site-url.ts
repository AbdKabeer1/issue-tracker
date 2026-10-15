/** App origin including basePath (e.g. https://contributors.zedu.chat/bug-tracker). */
export function getSiteUrl(): string {
  const raw =
    process.env.AUTH_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "http://localhost:3001/bug-tracker";
  return raw.replace(/\/$/, "");
}

export function absoluteUrl(path: string): string {
  const base = getSiteUrl();
  if (!path || path === "/") return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
