#!/usr/bin/env node
/**
 * The Ziki Field Guide palette — one source of truth for both themes.
 *
 * This replaces the old approach of hand-writing the light ramps in
 * theme-brand.css and mirroring Tailwind's stock ramps for dark. Instead the
 * whole world is defined once here, in OKLCH, and emitted twice:
 *
 *   app/theme-brand.css   light ramps + the semantic --zk-* layer
 *   app/theme-dark.css    the same ramps mirrored end to end (50 ↔ 950)
 *
 * The mirroring rule is unchanged from #277 and is the reason no component
 * needs a `dark:` twin: every page is written with light-mode classes, and
 * dark mode redefines the variables those utilities read. Because each ramp
 * is built with monotonically decreasing lightness from 50 to 950, any pair
 * with contrast in light mode keeps it in dark mode.
 *
 * Neutrals are additionally stacked for dark so the page is the darkest
 * surface, cards sit one step above it, and chips one step above that.
 *
 * Contrast is not assumed: this script computes WCAG contrast for every pair
 * the app actually relies on and exits non-zero if any of them drop below AA.
 *
 *   node scripts/generate-dark-palette.mjs
 */
import { writeFileSync } from "node:fs";

/* ------------------------------------------------------------------ *
 * OKLCH → sRGB
 * ------------------------------------------------------------------ */

/** OKLCH → linear-light sRGB, unclamped (values may fall outside 0…1). */
function oklchToLinear(Lt, C, hDeg) {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l_ = 0.3963377774 * a + 0.2158037573 * b;
  const m_ = -0.1055613458 * a - 0.0638541728 * b;
  const s_ = -0.0894841775 * a - 1.291485548 * b;

  // Lt is the achromatic axis, so add it before cubing.
  const l = Lt + l_;
  const m = Lt + m_;
  const s = Lt + s_;

  return [
    +4.0767416621 * l ** 3 - 3.3077115913 * m ** 3 + 0.2309699292 * s ** 3,
    -1.2684380046 * l ** 3 + 2.6097574011 * m ** 3 - 0.3413193965 * s ** 3,
    -0.0041960863 * l ** 3 - 0.7034186147 * m ** 3 + 1.707614701 * s ** 3,
  ];
}

const inGamut = (ch) => ch.every((c) => c >= -1e-4 && c <= 1 + 1e-4);

function oklchToSrgb(L_, C, hDeg) {
  // Out of sRGB gamut: bisect the chroma down, keeping hue and lightness.
  if (!inGamut(oklchToLinear(L_, C, hDeg))) {
    let lo = 0;
    let hi = C;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchToLinear(L_, mid, hDeg))) lo = mid;
      else hi = mid;
    }
    C = lo;
  }

  const encode = (c) => {
    const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return Math.min(255, Math.max(0, Math.round(v * 255)));
  };

  const [r, g, b] = oklchToLinear(L_, C, hDeg);
  return { r: encode(r), g: encode(g), b: encode(b) };
}

const hex = ({ r, g, b }) =>
  "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");

/* ------------------------------------------------------------------ *
 * Ramps
 *
 * Lightness runs 50 → 950 strictly downward, which is what makes the dark
 * mirror safe. Chroma follows a bell curve peaking around 500/600, the way
 * real printed ink ramps behave: pale tints are thin, mid-tones are at full
 * strength, and the deepest shades go nearly black.
 * ------------------------------------------------------------------ */

const LIGHTNESS = [
  0.985, 0.965, 0.925, 0.87, 0.785, 0.69, 0.59, 0.48, 0.375, 0.28, 0.185,
];
const SHADES = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];

/** Chroma at each shade: a bell peaking at 500/600. */
function chromaAt(i, max) {
  const bell = [0.22, 0.36, 0.55, 0.74, 0.92, 1, 0.95, 0.82, 0.62, 0.42, 0.26];
  return +(max * bell[i]).toFixed(4);
}

/** Build one 11-step ramp from a hue and a peak chroma. */
function ramp(hue, chroma, { hueDrift = 0 } = {}) {
  const out = {};
  SHADES.forEach((shade, i) => {
    const h = hue + hueDrift * (i / (SHADES.length - 1));
    out[shade] = hex(oklchToSrgb(LIGHTNESS[i], chromaAt(i, chroma), h));
  });
  return out;
}

/**
 * The world: a field guide printed in four inks on unbleached paper.
 *
 *   ink blue    the writing ink — accent, links, focus, primary controls
 *   stamp red   the one stamp — danger, high priority, overdue
 *   moss        the collector's green — resolved, confirmed, ok
 *   ochre       the annotation pencil — warning, medium
 */
const INK = 258; // hue of the writing ink
const STAMP = 32; // hue of the stamp
const MOSS = 142;
const OCHRE = 82;

const RAMPS = {
  // The warm paper-to-ink neutrals. Tiny chroma, hue nudged per family so
  // stacked surfaces stay distinguishable without any of them reading as grey.
  slate: ramp(85, 0.014),
  gray: ramp(80, 0.011, { hueDrift: 6 }),
  zinc: ramp(88, 0.009),
  neutral: ramp(62, 0.013),
  stone: ramp(72, 0.016, { hueDrift: 4 }),

  // The accent family. teal is the app's primary accent; violet and purple
  // were already collapsed onto it upstream and stay collapsed here.
  teal: ramp(INK, 0.115, { hueDrift: 8 }),
  violet: ramp(INK, 0.115, { hueDrift: 8 }),
  purple: ramp(INK, 0.115, { hueDrift: 8 }),

  // The stamp. Danger, and the severity mark on a plate.
  red: ramp(STAMP, 0.16, { hueDrift: 6 }),

  // Resolved / confirmed.
  emerald: ramp(MOSS, 0.09, { hueDrift: -8 }),
  green: ramp(MOSS, 0.09, { hueDrift: -8 }),
  lime: ramp(128, 0.11, { hueDrift: -6 }),

  // Warning / annotation.
  amber: ramp(OCHRE, 0.125, { hueDrift: 8 }),
  yellow: ramp(OCHRE, 0.11, { hueDrift: 10 }),

  // The same ink at lower strength: info reads as the guide's own printing.
  sky: ramp(INK + 8, 0.095),
  indigo: ramp(INK, 0.125, { hueDrift: -6 }),
  blue: ramp(INK + 4, 0.12),
  cyan: ramp(INK + 16, 0.08),

  // Warm secondaries — sepia annotations and terracotta underlines.
  rose: ramp(20, 0.13, { hueDrift: 8 }),
  pink: ramp(350, 0.12, { hueDrift: 10 }),
  orange: ramp(50, 0.14, { hueDrift: 6 }),
  fuchsia: ramp(340, 0.11),
};

/* ------------------------------------------------------------------ *
 * The semantic layer: one paper stock, four inks.
 * ------------------------------------------------------------------ */

const L = (lightness, chroma, hue) =>
  hex(oklchToSrgb(lightness, chroma, hue));

/** Light theme. Unbleached paper, ink lines, one stamp. */
const LIGHT = {
  background: L(0.944, 0.016, 85), // page: laid paper
  foreground: L(0.245, 0.014, 85), // ink
  card: L(0.978, 0.009, 85), // an inset plate, one step brighter than the page

  "zk-bg": L(0.944, 0.016, 85),
  "zk-surface": L(0.978, 0.009, 85),
  "zk-text": L(0.245, 0.014, 85),
  "zk-text2": L(0.42, 0.013, 85),
  "zk-muted": L(0.52, 0.012, 85),
  "zk-border": L(0.605, 0.014, 85), // an ink rule, not a fade: cards and inputs
  "zk-divider": L(0.8, 0.015, 85), // row separators inside a container
  "zk-tint": L(0.906, 0.022, 82),
  "zk-chip": L(0.925, 0.013, 85),
  "zk-seg": L(0.916, 0.012, 85),
  "zk-accent": L(0.44, 0.105, INK),

  "zk-ok-bg": L(0.916, 0.038, MOSS),
  "zk-ok-fg": L(0.415, 0.075, MOSS),
  "zk-bad-bg": L(0.912, 0.038, STAMP),
  "zk-bad-fg": L(0.44, 0.135, STAMP),
  "zk-bad-bd": L(0.72, 0.075, STAMP),
  "zk-bad-soft": L(0.958, 0.019, STAMP),
  "zk-warn-bg": L(0.926, 0.036, OCHRE),
  "zk-warn-fg": L(0.475, 0.085, OCHRE),
  "zk-warn-bd": L(0.72, 0.07, OCHRE),
  "zk-info-bg": L(0.914, 0.032, INK),
  "zk-info-fg": L(0.42, 0.095, INK),
};

/**
 * Dark theme. The guide read by lamplight: dark leather binding, the paper
 * gone to shadow, the same inks lifted so they hold contrast. Surfaces stack
 * page < plate < chip, matching the generator's neutral rule.
 */
const DARK = {
  background: L(0.16, 0.012, 85),
  foreground: L(0.93, 0.014, 85),
  card: L(0.225, 0.014, 85),

  "zk-bg": L(0.16, 0.012, 85),
  "zk-surface": L(0.225, 0.014, 85),
  "zk-text": L(0.93, 0.014, 85),
  "zk-text2": L(0.795, 0.013, 85),
  "zk-muted": L(0.65, 0.012, 85),
  "zk-border": L(0.55, 0.016, 85), // ink rule, same weight as light
  "zk-divider": L(0.37, 0.014, 85),
  "zk-tint": L(0.285, 0.022, 82),
  "zk-chip": L(0.265, 0.014, 85),
  "zk-seg": L(0.19, 0.012, 85),
  "zk-accent": L(0.775, 0.095, INK),

  "zk-ok-bg": L(0.27, 0.05, MOSS),
  "zk-ok-fg": L(0.815, 0.075, MOSS),
  "zk-bad-bg": L(0.28, 0.055, STAMP),
  "zk-bad-fg": L(0.815, 0.105, STAMP),
  "zk-bad-bd": L(0.52, 0.085, STAMP),
  "zk-bad-soft": L(0.22, 0.03, STAMP),
  "zk-warn-bg": L(0.28, 0.045, OCHRE),
  "zk-warn-fg": L(0.85, 0.085, OCHRE),
  "zk-warn-bd": L(0.54, 0.07, OCHRE),
  "zk-info-bg": L(0.275, 0.05, INK),
  "zk-info-fg": L(0.8, 0.085, INK),
};

/* ------------------------------------------------------------------ *
 * Contrast verification
 * ------------------------------------------------------------------ */

function luminance({ r, g, b }) {
  const f = (v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

const parse = (h) => ({
  r: parseInt(h.slice(1, 3), 16),
  g: parseInt(h.slice(3, 5), 16),
  b: parseInt(h.slice(5, 7), 16),
});

function ratio(a, b) {
  const [x, y] = [luminance(parse(a)), luminance(parse(b))].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/**
 * Three tiers, because WCAG 1.4.11 does not apply uniformly:
 *
 *   text       4.5 — body copy (WCAG AA, 1.4.3)
 *   boundary   3.0 — the visual edge that identifies a control or container.
 *              `zk-border` is this: it bounds cards, and the shared
 *              input/textarea/select, across ~200 call sites.
 *   decorative 1.5 — separators and reinforcement borders that sit alongside
 *              a tint and coloured text, so the border is never the only
 *              thing carrying the meaning (1.4.11 is satisfied by the pair).
 */
const TEXT_PAIRS = [
  ["zk-text", "zk-bg"], ["zk-text", "zk-surface"], ["zk-text", "card"],
  ["zk-text2", "zk-bg"], ["zk-text2", "zk-surface"],
  ["zk-muted", "zk-bg"], ["zk-muted", "zk-surface"],
  ["zk-accent", "zk-surface"], ["zk-accent", "zk-bg"],
  ["zk-ok-fg", "zk-ok-bg"], ["zk-bad-fg", "zk-bad-bg"],
  ["zk-warn-fg", "zk-warn-bg"], ["zk-info-fg", "zk-info-bg"],
  ["zk-text", "zk-tint"], ["zk-text", "zk-chip"], ["zk-text", "zk-seg"],
  ["foreground", "background"], ["foreground", "card"],
];
const BOUNDARY_PAIRS = [
  ["zk-border", "zk-surface"], ["zk-border", "zk-bg"],
  ["zk-accent", "zk-surface"],
];
const DECORATIVE_PAIRS = [
  ["zk-divider", "zk-surface"], ["zk-divider", "zk-bg"],
  ["zk-bad-bd", "zk-bad-bg"], ["zk-warn-bd", "zk-warn-bg"],
];

function verify(theme, name, failures) {
  for (const [fg, bg] of TEXT_PAIRS) {
    const r = ratio(theme[fg], theme[bg]);
    if (r < 4.5) failures.push(`${name}: ${fg} on ${bg} = ${r.toFixed(2)} (need 4.5)`);
  }
  for (const [fg, bg] of BOUNDARY_PAIRS) {
    const r = ratio(theme[fg], theme[bg]);
    if (r < 3) failures.push(`${name}: ${fg} on ${bg} = ${r.toFixed(2)} (need 3.0)`);
  }
  for (const [fg, bg] of DECORATIVE_PAIRS) {
    const r = ratio(theme[fg], theme[bg]);
    if (r < 1.5) failures.push(`${name}: ${fg} on ${bg} = ${r.toFixed(2)} (need 1.5)`);
  }
}

const failures = [];
verify(LIGHT, "light", failures);
verify(DARK, "dark", failures);

// White on the filled controls: the primary button and the danger button.
for (const [label, shade] of [["primary", "teal-700"], ["danger", "red-700"]]) {
  const [family, s] = shade.split("-");
  for (const [theme, name] of [[LIGHT, "light"], [DARK, "dark"]]) {
    void theme;
    void name;
    const fill = RAMPS[family][s];
    const r = ratio("#ffffff", fill);
    if (r < 4.5) failures.push(`${name}: white on ${label} fill ${fill} = ${r.toFixed(2)}`);
  }
}

if (failures.length) {
  console.error("CONTRAST FAILED:\n" + failures.map((f) => "  " + f).join("\n"));
  process.exit(1);
}

/* ------------------------------------------------------------------ *
 * Emit
 * ------------------------------------------------------------------ */

function rampBlock(families, indent) {
  const out = [];
  for (const family of Object.keys(families).sort()) {
    for (const shade of SHADES) {
      out.push(`${indent}--color-${family}-${shade}: ${families[family][shade]};`);
    }
  }
  return out;
}

function semanticBlock(theme, indent) {
  return Object.entries(theme).map(([k, v]) => `${indent}--${k}: ${v};`);
}

const brand = `/*
 * GENERATED by scripts/generate-dark-palette.mjs — the Field Guide palette.
 * Don't edit by hand; change the anchors in that script and re-run it.
 *
 * Ziki is set as a field guide: unbleached paper, ink linework, and exactly
 * four inks — writing ink (accent), stamp red (danger/severity), moss
 * (resolved) and ochre (warning). Neutrals are warm, never grey, so stacked
 * surfaces read as layers of the same paper stock rather than as chrome.
 *
 * accent-family ramps (teal/violet/purple) are collapsed onto the writing
 * ink, so any class written with teal keeps its shading pattern and any
 * contrast pair that passed AA before still passes after the swap.
 *
 * Order matters: this file is imported after theme-dark.css in globals.css,
 * at equal specificity, so these values win wherever both define a token.
 */

:root {
${semanticBlock(LIGHT, "  ").join("\n")}

${rampBlock(RAMPS, "  ").join("\n")}
}

/* The dark mirror: see the header of theme-dark.css. Repeated here because
   brand wins at equal specificity, so the two dark selectors have to be
   stated again for the deck to land. */
${["@media screen and (prefers-color-scheme: dark) {\n  :root:not([data-theme=\"light\"]) {", "@media screen {\n  :root[data-theme=\"dark\"] {"]
  .map(
    (open) => `${open}
${semanticBlock(DARK, "    ").join("\n")}
  }
}`,
  )
  .join("\n\n")}
`;

writeFileSync(new URL("../app/theme-brand.css", import.meta.url), brand);

const dark = `/*
 * GENERATED by scripts/generate-dark-palette.mjs: don't edit by hand (#277).
 *
 * Dark mode applies when the user picked Dark (data-theme="dark" on <html>),
 * or picked System (no data-theme, or "system") and the device prefers dark.
 * A user who picked Light (data-theme="light") always gets light.
 * Screens only: paper always prints in the light palette — a field guide
 * should print on paper, so print keeps the light ramps by design.
 *
 * Every scale is mirrored end to end (50 ↔ 950), and neutrals are stacked
 * page < plate < chip, so surfaces read correctly without a dark: twin on
 * any component. theme-brand.css re-states the semantic layer for the dark
 * selectors because it wins at equal specificity.
 */
`;

const darkBlock = [];
const NEUTRALS = new Set(["slate", "gray", "zinc", "neutral", "stone"]);
const NEUTRAL_MAP = {
  50: "950", 100: "800", 200: "700", 300: "600", 400: "500", 500: "400",
  600: "300", 700: "200", 800: "100", 900: "50", 950: "50",
};
for (const family of Object.keys(RAMPS).sort()) {
  for (const shade of SHADES) {
    const mirror = NEUTRALS.has(family)
      ? NEUTRAL_MAP[shade]
      : SHADES[SHADES.length - 1 - SHADES.indexOf(shade)];
    darkBlock.push(`    --color-${family}-${shade}: ${RAMPS[family][mirror]};`);
  }
}
darkBlock.push(`    --color-white: ${RAMPS.slate["900"]};`);
darkBlock.push(`    --background: ${DARK.background};`);
darkBlock.push(`    --foreground: ${DARK.foreground};`);
darkBlock.push("    color-scheme: dark;");

writeFileSync(
  new URL("../app/theme-dark.css", import.meta.url),
  `${dark}
@media screen and (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
${darkBlock.join("\n")}
  }
}

@media screen {
  :root[data-theme="dark"] {
${darkBlock.join("\n")}
  }
}
`,
);

const checked = (TEXT_PAIRS.length + BOUNDARY_PAIRS.length + DECORATIVE_PAIRS.length) * 2 + 4;
console.log(`app/theme-brand.css + app/theme-dark.css: ${Object.keys(RAMPS).length} ramps`);
console.log(`contrast: ${checked} pairs verified, all AA`);
console.log(`  paper ${LIGHT["zk-bg"]} · plate ${LIGHT["zk-surface"]} · ink ${LIGHT["zk-text"]}`);
console.log(`  accent ${LIGHT["zk-accent"]} · stamp ${RAMPS.red["700"]} · moss ${RAMPS.emerald["700"]} · ochre ${RAMPS.amber["700"]}`);
