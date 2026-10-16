import { describe, expect, it } from "vitest";
import { escapeSearchQuery } from "./search";

describe("escapeSearchQuery", () => {
  it("leaves standard alphanumeric text untouched", () => {
    expect(escapeSearchQuery("login issue")).toBe("login issue");
    expect(escapeSearchQuery("bug 123")).toBe("bug 123");
  });

  it("escapes SQL LIKE % wildcard", () => {
    expect(escapeSearchQuery("%")).toBe("\\%");
    expect(escapeSearchQuery("50% off")).toBe("50\\% off");
  });

  it("escapes SQL LIKE _ wildcard", () => {
    expect(escapeSearchQuery("_")).toBe("\\_");
    expect(escapeSearchQuery("test_case")).toBe("test\\_case");
  });

  it("escapes backslashes", () => {
    expect(escapeSearchQuery("\\")).toBe("\\\\");
    expect(escapeSearchQuery("path\\to\\file")).toBe("path\\\\to\\\\file");
  });

  it("escapes combined wildcard characters in one query", () => {
    expect(escapeSearchQuery("100%_complete\\tested")).toBe(
      "100\\%\\_complete\\\\tested",
    );
  });

  it("handles empty string gracefully", () => {
    expect(escapeSearchQuery("")).toBe("");
  });
});
