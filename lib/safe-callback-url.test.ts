import { describe, expect, it } from "vitest";
import { safeCallbackUrl } from "./safe-callback-url";

describe("safeCallbackUrl", () => {
  it("defaults to /issues on null or non-string", () => {
    expect(safeCallbackUrl(null)).toBe("/issues");
    expect(safeCallbackUrl(undefined)).toBe("/issues");
    expect(safeCallbackUrl("")).toBe("/issues");
  });

  it("blocks external open redirects", () => {
    expect(safeCallbackUrl("https://evil.com")).toBe("/issues");
    expect(safeCallbackUrl("//evil.com")).toBe("/issues");
    expect(safeCallbackUrl("/\\evil.com")).toBe("/issues");
    expect(safeCallbackUrl("/\\evil.example")).toBe("/issues");
    expect(safeCallbackUrl("/\\/evil.com")).toBe("/issues");
    expect(safeCallbackUrl("/path\\with\\backslash")).toBe("/issues");
    expect(safeCallbackUrl("/\t/evil.example")).toBe("/issues");
    expect(safeCallbackUrl("/\n/evil.example")).toBe("/issues");
    expect(safeCallbackUrl("/\r/evil.example")).toBe("/issues");
    expect(safeCallbackUrl("javascript:alert(1)")).toBe("/issues");
  });

  it("keeps app-relative paths untouched", () => {
    expect(safeCallbackUrl("/issues")).toBe("/issues");
    expect(safeCallbackUrl("/issues/new")).toBe("/issues/new");
    expect(safeCallbackUrl("/bugs")).toBe("/bugs");
    expect(safeCallbackUrl("/bugs/new")).toBe("/bugs/new");
    expect(safeCallbackUrl("/admin/users")).toBe("/admin/users");
  });

  it("strips deploy basePath prefix to prevent double-prefix redirects", () => {
    expect(safeCallbackUrl("/bug-tracker/issues")).toBe("/issues");
    expect(safeCallbackUrl("/bug-tracker/bugs")).toBe("/bugs");
    expect(safeCallbackUrl("/bug-tracker/bugs/new")).toBe("/bugs/new");
    expect(safeCallbackUrl("/bug-tracker")).toBe("/");
  });

  it("rejects auth routes to prevent bounce loops (#352)", () => {
    expect(safeCallbackUrl("/login")).toBe("/issues");
    expect(safeCallbackUrl("/login?callbackUrl=%2Fbugs")).toBe("/issues");
    expect(safeCallbackUrl("/signup")).toBe("/issues");
    expect(safeCallbackUrl("/forgot-password")).toBe("/issues");
    expect(safeCallbackUrl("/reset-password")).toBe("/issues");
    expect(safeCallbackUrl("/reset-password?token=xyz")).toBe("/issues");
    expect(safeCallbackUrl("/session-expired")).toBe("/issues");
    expect(safeCallbackUrl("/api/auth/signout")).toBe("/issues");
    expect(safeCallbackUrl("/api/auth/callback/google")).toBe("/issues");
    expect(safeCallbackUrl("/bug-tracker/login")).toBe("/issues");
    expect(safeCallbackUrl("/login#section")).toBe("/issues");
    expect(safeCallbackUrl("/bugs/../login")).toBe("/issues");
    expect(safeCallbackUrl("/bugs#section")).toBe("/bugs#section");
  });
});
