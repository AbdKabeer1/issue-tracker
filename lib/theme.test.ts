import { describe, expect, it } from "vitest";
import { isTheme, parseTheme, themeAttribute } from "./theme";

describe("theme (#277)", () => {
  it("accepts only the three choices", () => {
    expect(isTheme("dark")).toBe(true);
    expect(isTheme("blue")).toBe(false);
    expect(isTheme(undefined)).toBe(false);
  });
  it("falls back to following the device", () => {
    expect(parseTheme("nope")).toBe("system");
    expect(parseTheme(null)).toBe("system");
    expect(parseTheme("light")).toBe("light");
  });
  it("only pins the attribute for an explicit choice", () => {
    expect(themeAttribute("system")).toBeUndefined();
    expect(themeAttribute("dark")).toBe("dark");
    expect(themeAttribute("light")).toBe("light");
  });
});
