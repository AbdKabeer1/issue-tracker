import { describe, expect, it } from "vitest";
import { escapeSearchQuery, toSingleQueryParam } from "./search";

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

  it("keeps the search literal, so a wildcard cannot widen the match", () => {
    // Prisma compiles `contains` to ILIKE '%' || $1 || '%' and binds the term
    // unescaped, so the escaping here is the only thing stopping a "%" from
    // matching every issue. These are the values that reach PostgreSQL.
    expect(escapeSearchQuery("%")).not.toBe("%");
    expect(escapeSearchQuery("%")).not.toMatch(/(?<!\\)%/);
    expect(escapeSearchQuery("_")).not.toMatch(/(?<!\\)_/);
  });
});

describe("toSingleQueryParam", () => {
  it("returns single string value untouched", () => {
    expect(toSingleQueryParam("hello")).toBe("hello");
    expect(toSingleQueryParam("")).toBe("");
  });

  it("returns the first element when given an array of strings", () => {
    expect(toSingleQueryParam(["first", "second"])).toBe("first");
    expect(toSingleQueryParam(["single"])).toBe("single");
  });

  it("returns undefined for null, undefined, or empty array", () => {
    expect(toSingleQueryParam(undefined)).toBeUndefined();
    expect(toSingleQueryParam(null)).toBeUndefined();
    expect(toSingleQueryParam([])).toBeUndefined();
  });
});

