import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site-url";

/**
 * /sitemap.xml (#310).
 *
 * Deliberately short. Issue pages are excluded: they send
 * `robots: { index: false }` and are mostly private. The sign-in and sign-up
 * pages are excluded too, because robots.ts disallows them (#224), and a
 * sitemap that lists a URL robots.txt blocks makes search engines report
 * "Submitted URL blocked by robots.txt" rather than index anything.
 *
 * That leaves the site root. URLs come from the configured site URL, never
 * the request host, so a request with a spoofed Host header cannot put
 * someone else's domain into the file.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: absoluteUrl("/"),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
