import { describe, expect, it } from "vitest";
import { safeCallbackUrl } from "./safe-callback-url";

describe("safeCallbackUrl", () => {
  it("defaults to /dashboard on null or non-string", () => {
    expect(safeCallbackUrl(null)).toBe("/dashboard");
    expect(safeCallbackUrl(undefined)).toBe("/dashboard");
    expect(safeCallbackUrl("")).toBe("/dashboard");
  });

  it("blocks external open redirects", () => {
    expect(safeCallbackUrl("https://evil.com")).toBe("/dashboard");
    expect(safeCallbackUrl("//evil.com")).toBe("/dashboard");
    expect(safeCallbackUrl("/\\evil.com")).toBe("/dashboard");
    expect(safeCallbackUrl("/\\evil.example")).toBe("/dashboard");
    expect(safeCallbackUrl("/\\/evil.com")).toBe("/dashboard");
    expect(safeCallbackUrl("/path\\with\\backslash")).toBe("/dashboard");
    expect(safeCallbackUrl("/\t/evil.example")).toBe("/dashboard");
    expect(safeCallbackUrl("/\n/evil.example")).toBe("/dashboard");
    expect(safeCallbackUrl("/\r/evil.example")).toBe("/dashboard");
    expect(safeCallbackUrl("javascript:alert(1)")).toBe("/dashboard");
  });

  it("keeps app-relative paths untouched", () => {
    expect(safeCallbackUrl("/issues")).toBe("/issues");
    expect(safeCallbackUrl("/issues/new")).toBe("/issues/new");
    expect(safeCallbackUrl("/bugs")).toBe("/bugs");
    expect(safeCallbackUrl("/bugs/new")).toBe("/bugs/new");
    expect(safeCallbackUrl("/admin/users")).toBe("/admin/users");
    // The dashboard itself is a valid signed-in destination.
    expect(safeCallbackUrl("/dashboard")).toBe("/dashboard");
  });

  it("strips deploy basePath prefix to prevent double-prefix redirects", () => {
    expect(safeCallbackUrl("/bug-tracker/issues")).toBe("/issues");
    expect(safeCallbackUrl("/bug-tracker/bugs")).toBe("/bugs");
    expect(safeCallbackUrl("/bug-tracker/bugs/new")).toBe("/bugs/new");
    expect(safeCallbackUrl("/bug-tracker")).toBe("/");
  });

  it("rejects auth routes to prevent bounce loops (#352)", () => {
    expect(safeCallbackUrl("/login")).toBe("/dashboard");
    expect(safeCallbackUrl("/login?callbackUrl=%2Fbugs")).toBe("/dashboard");
    expect(safeCallbackUrl("/signup")).toBe("/dashboard");
    expect(safeCallbackUrl("/forgot-password")).toBe("/dashboard");
    expect(safeCallbackUrl("/reset-password")).toBe("/dashboard");
    expect(safeCallbackUrl("/reset-password?token=xyz")).toBe("/dashboard");
    expect(safeCallbackUrl("/session-expired")).toBe("/dashboard");
    expect(safeCallbackUrl("/api/auth/signout")).toBe("/dashboard");
    expect(safeCallbackUrl("/api/auth/callback/google")).toBe("/dashboard");
    expect(safeCallbackUrl("/bug-tracker/login")).toBe("/dashboard");
    expect(safeCallbackUrl("/login#section")).toBe("/dashboard");
    expect(safeCallbackUrl("/bugs/../login")).toBe("/dashboard");
    expect(safeCallbackUrl("/bugs#section")).toBe("/bugs#section");
  });
});
