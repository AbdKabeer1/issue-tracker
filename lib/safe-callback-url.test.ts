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
});
