/**
 * Accounts the seed creates. Desktop and mobile runs get separate people,
 * because issue creation and sign-in are rate limited per user.
 */
export const E2E_PASSWORD = "e2e-password-123";

export type Role = "user" | "admin" | "super";
export type Width = "desktop" | "mobile";

export function emailFor(role: Role, width: Width): string {
  return `e2e-${role}-${width}@test.local`;
}

export function nameFor(role: Role, width: Width): string {
  const r = { user: "Uma User", admin: "Ada Admin", super: "Sam Super" }[role];
  return `${r} ${width === "desktop" ? "D" : "M"}`;
}

/** Signs in fresh in the session-expiry test, then is deleted mid-session. */
export const STALE_EMAIL = (width: Width) => `e2e-stale-${width}@test.local`;

export const ROLES: Role[] = ["user", "admin", "super"];
export const WIDTHS: Width[] = ["desktop", "mobile"];

export function authFile(role: Role, width: Width): string {
  return `e2e/.auth/${role}-${width}.json`;
}

export function widthOf(projectName: string): Width {
  return projectName === "mobile" ? "mobile" : "desktop";
}
