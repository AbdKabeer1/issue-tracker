/**
 * Social/link-preview image.
 *
 * Must be a raster format: X, LinkedIn, WhatsApp, Facebook and Discord all
 * drop `og:image` / `twitter:image` when it points at an SVG. `summary_large_image`
 * also needs at least 300x157, so the 32x32 `/zedu-mark.svg` in `public/` is
 * unsuitable for unfurls — it is only for the in-app favicon.
 *
 * Dimensions must stay in sync with `public/Zedu.png`.
 */
export const SHARE_IMAGE = {
  url: "/Zedu.png",
  alt: "Ziki Issues",
  width: 460,
  height: 200,
  type: "image/png",
} as const;