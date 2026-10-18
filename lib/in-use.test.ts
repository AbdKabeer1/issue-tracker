import { describe, expect, it } from "vitest";
import { inUseHrefs, inUseText } from "./in-use";

describe("inUseText", () => {
  it("says the same thing for a platform and a type", () => {
    const p = inUseText({ kind: "platform", name: "Web", total: 3, deleted: 0 });
    const t = inUseText({ kind: "type", name: "Web", total: 3, deleted: 0 });
    expect(p.reason.replace("platform", "X")).toBe(t.reason.replace("issue type", "X"));
  });

  it("explains the refusal with the real count", () => {
    expect(inUseText({ kind: "platform", name: "Desktop", total: 3, deleted: 0 }).reason).toBe(
      "The platform “Desktop” can't be deleted because 3 issues use it.",
    );
    expect(inUseText({ kind: "type", name: "Fix", total: 1, deleted: 0 }).reason).toBe(
      "The issue type “Fix” can't be deleted because 1 issue uses it.",
    );
  });

  it("labels the live link with only the issues the list will show", () => {
    // Deleted issues block deletion but are hidden from the normal list.
    const text = inUseText({ kind: "platform", name: "Web", total: 5, deleted: 2 });
    expect(text.liveLink).toBe("View the 3 issues");
    expect(text.deletedLink).toBe("2 deleted issues");
  });

  it("offers no live link when every issue using it is deleted", () => {
    const text = inUseText({ kind: "type", name: "Old", total: 1, deleted: 1 });
    expect(text.liveLink).toBeNull();
    expect(text.deletedLink).toBe("1 deleted issue");
  });

  it("offers no deleted link when none are deleted", () => {
    expect(inUseText({ kind: "type", name: "A", total: 2, deleted: 0 }).deletedLink).toBeNull();
  });
});

describe("inUseHrefs", () => {
  it("filters the list by platform id", () => {
    expect(inUseHrefs("platform", "cat_web")).toEqual({
      live: "/bugs?platform=cat_web",
      deleted: "/bugs?deleted=true&platform=cat_web",
    });
  });

  it("filters the list by type through the tag filter, escaping the name", () => {
    expect(inUseHrefs("type", "UX research").live).toBe("/bugs?tags=UX%20research");
  });
});
