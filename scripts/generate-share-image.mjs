#!/usr/bin/env node
/**
 * Generates public/ziki-share.png, the link-preview image (lib/share-image.ts).
 *
 * Unfurlers drop SVG og:images, so the card is rendered to PNG here from the
 * same mark as public/ziki-mark.svg. 1200x630 is the size X, LinkedIn,
 * WhatsApp, Slack and Facebook all crop to without letterboxing.
 *
 *   node scripts/generate-share-image.mjs   (after changing the brand mark)
 */
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// sharp ships with Next.js for image optimisation, so nothing extra to install.
const sharp = require(require.resolve("sharp", { paths: [require.resolve("next")] }));

const WIDTH = 1200;
const HEIGHT = 630;
const FONT = "Segoe UI, Helvetica Neue, Helvetica, Arial, sans-serif";

// public/ziki-mark.svg, drawn at 32x32 and scaled up by MARK_SCALE.
const MARK_SCALE = 6;
const mark = `
  <g transform="translate(120 159) scale(${MARK_SCALE})">
    <rect width="32" height="32" rx="7.5" fill="url(#ziki-bg)"/>
    <rect x="0.5" y="0.5" width="31" height="31" rx="7" stroke="#2DD4BF" stroke-opacity="0.3"/>
    <path d="M8.5 11C8.5 10.17 9.17 9.5 10 9.5H22C22.83 9.5 23.5 10.17 23.5 11C23.5 11.45 23.3 11.87 22.95 12.15L13.8 19.5H22C22.83 19.5 23.5 20.17 23.5 21C23.5 21.83 22.83 22.5 22 22.5H10C9.17 22.5 8.5 21.83 8.5 21C8.5 20.55 8.7 20.13 9.05 19.85L18.2 12.5H10C9.17 12.5 8.5 11.83 8.5 11Z" fill="url(#ziki-z)"/>
  </g>`;

const svg = `<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="ziki-bg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#14B8A6"/>
      <stop offset="45%" stop-color="#0D9488"/>
      <stop offset="100%" stop-color="#0F766E"/>
    </linearGradient>
    <linearGradient id="ziki-z" x1="8" y1="9" x2="24" y2="23" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#E0F2FE"/>
    </linearGradient>
    <linearGradient id="page" x1="0" y1="0" x2="${WIDTH}" y2="${HEIGHT}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#F0FDFA"/>
    </linearGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#page)"/>
  <rect y="${HEIGHT - 12}" width="${WIDTH}" height="12" fill="#0F766E"/>
  ${mark}
  <text x="372" y="292" font-family="${FONT}" font-size="132" font-weight="700" fill="#0F172A" letter-spacing="-3">Ziki</text>
  <text x="378" y="370" font-family="${FONT}" font-size="40" fill="#475569">Resolve issues faster with AI agents</text>
  <text x="378" y="420" font-family="${FONT}" font-size="40" fill="#475569">and human verification.</text>
  <text x="120" y="548" font-family="${FONT}" font-size="34" font-weight="600" fill="#0F766E">ziki.dev</text>
</svg>`;

const out = new URL("../public/ziki-share.png", import.meta.url);
const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
writeFileSync(out, png);
console.log(`Wrote ${out.pathname} (${WIDTH}x${HEIGHT}, ${png.length} bytes)`);
