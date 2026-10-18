/**
 * Appearance (#277). The palette lives in app/theme-dark.css; this decides
 * which one a page starts in.
 *
 * The server writes the choice onto <html data-theme> before anything is
 * sent, so there is never a flash of the wrong theme:
 * - "light" / "dark" pin it;
 * - "system" leaves it to `prefers-color-scheme`, which CSS reads on the
 *   very first paint, so it needs no script either.
 *
 * Signed in, the choice comes from the user's row and so follows them to
 * every device. Signed out (sign-in, password reset), a cookie set when
 * they last chose keeps that device's pages consistent.
 */
export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_COOKIE = "theme";
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const themeLabels: Record<Theme, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

export const themeDescriptions: Record<Theme, string> = {
  system: "Match this device's setting",
  light: "Always light",
  dark: "Always dark",
};

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

export function parseTheme(value: unknown): Theme {
  return isTheme(value) ? value : "system";
}

/** The data-theme attribute to render: none for "system", so CSS decides. */
export function themeAttribute(theme: Theme): "light" | "dark" | undefined {
  return theme === "system" ? undefined : theme;
}
