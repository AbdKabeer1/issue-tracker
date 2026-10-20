import { getSiteUrl } from "@/lib/site-url";

/**
 * Whether a request's Origin or Referer is a different site than this app.
 *
 * Agent key rotation is authorized by a bearer token, not a cookie, so a
 * foreign page cannot attach the secret (#654). This check is defense in
 * depth for browsers, which send Origin. curl and other API clients omit
 * both headers and are allowed. A bad or cross-site Origin is rejected.
 */
export function isCrossSiteRequest(headers: { get(name: string): string | null }): boolean {
  const source = headers.get("origin") || headers.get("referer");
  if (!source) return false;
  let sourceOrigin: string;
  try {
    sourceOrigin = new URL(source).origin;
  } catch {
    return true;
  }
  let siteOrigin: string;
  try {
    siteOrigin = new URL(getSiteUrl()).origin;
  } catch {
    return true;
  }
  return sourceOrigin !== siteOrigin;
}
