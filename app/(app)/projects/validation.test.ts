import { describe, expect, it } from "vitest";
import {
  nextProjectSlug,
  PROJECT_SLUG_MAX,
  projectNameSchema,
  projectSlugBase,
} from "./validation";

describe("projectNameSchema (#426)", () => {
  it("trims and accepts a normal name", () => {
    expect(projectNameSchema.parse({ name: "  Zedu Web  " })).toEqual({
      name: "Zedu Web",
    });
  });

  it("rejects blank and overlong names", () => {
    expect(projectNameSchema.safeParse({ name: " " }).success).toBe(false);
    expect(projectNameSchema.safeParse({ name: "x".repeat(61) }).success).toBe(false);
  });
});

describe("projectSlugBase (#426)", () => {
  it("makes a URL-safe slug", () => {
    expect(projectSlugBase("Zedu Web")).toBe("zedu-web");
    expect(projectSlugBase("Café & Desktop")).toBe("cafe-desktop");
    expect(projectSlugBase("  ")).toBe("project");
  });

  it("caps the slug length", () => {
    expect(projectSlugBase("a".repeat(100))).toHaveLength(PROJECT_SLUG_MAX);
  });
});

describe("nextProjectSlug (#426)", () => {
  it("uses the base when it is free", () => {
    expect(nextProjectSlug("zedu-web", new Set())).toBe("zedu-web");
  });

  it("appends a counter for collisions", () => {
    expect(nextProjectSlug("zedu-web", new Set(["zedu-web"]))).toBe("zedu-web-2");
    expect(nextProjectSlug("zedu-web", new Set(["zedu-web", "zedu-web-2"]))).toBe(
      "zedu-web-3",
    );
  });

  it("keeps the suffix inside the slug limit", () => {
    const base = "a".repeat(PROJECT_SLUG_MAX);
    const slug = nextProjectSlug(base, new Set([base]));
    expect(slug.length).toBeLessThanOrEqual(PROJECT_SLUG_MAX);
    expect(slug.endsWith("-2")).toBe(true);
  });
});
