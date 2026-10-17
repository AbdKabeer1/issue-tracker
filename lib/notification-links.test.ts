import { describe, expect, it } from "vitest";
import { safeNotificationPath } from "./notification-links";

describe("safeNotificationPath", () => {
  it("keeps app-relative links, including comment anchors", () => {
    expect(safeNotificationPath("/bugs/b1#comment-c9")).toBe("/bugs/b1#comment-c9");
  });

  it("refuses anything that could leave the app", () => {
    for (const url of ["//evil.example/x", "/\\evil.example", "https://evil.example", "javascript:alert(1)", ""]) {
      expect(safeNotificationPath(url)).toBe("/bugs");
    }
  });
});
