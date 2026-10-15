/** Served at https://contributors.zedu.chat/bug-tracker */
export const BASE_PATH = "/bug-tracker";

/**
 * Strips the deploy basePath from a request pathname.
 * Proxy/middleware can see either form (`/bug-tracker/bugs` or `/bugs`),
 * so both must resolve to the app-relative path.
 */
export function toAppPath(pathname: string): string {
  if (pathname === BASE_PATH) return "/";
  if (pathname.startsWith(`${BASE_PATH}/`)) {
    return pathname.slice(BASE_PATH.length) || "/";
  }
  return pathname;
}
