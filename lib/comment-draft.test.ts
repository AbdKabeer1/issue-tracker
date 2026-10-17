import { describe, expect, it } from "vitest";
import {
  DRAFT_TTL_MS,
  clearDraft,
  draftKey,
  readDraft,
  writeDraft,
} from "./comment-draft";

function store(initial: Record<string, string> = {}) {
  const held = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => held.get(k) ?? null,
    setItem: (k: string, v: string) => void held.set(k, v),
    removeItem: (k: string) => void held.delete(k),
    size: () => held.size,
    raw: (k: string) => held.get(k),
  };
}

const angry = {
  getItem() {
    throw new Error("blocked");
  },
  setItem() {
    throw new Error("blocked");
  },
  removeItem() {
    throw new Error("blocked");
  },
};

describe("draftKey", () => {
  it("separates each issue, and a reply from the issue's own box", () => {
    expect(draftKey("b1")).not.toBe(draftKey("b2"));
    expect(draftKey("b1")).not.toBe(draftKey("b1", "c9"));
    expect(draftKey("b1", "c9")).not.toBe(draftKey("b1", "c8"));
  });

  it("is stable for the same inputs", () => {
    expect(draftKey("b1", "c9")).toBe(draftKey("b1", "c9"));
  });
});

describe("writeDraft and readDraft", () => {
  it("round-trips what was typed", () => {
    const s = store();
    writeDraft(s, "k", "half a thought");
    expect(readDraft(s, "k")).toBe("half a thought");
  });

  it("removes the entry when the box is emptied", () => {
    const s = store();
    writeDraft(s, "k", "something");
    writeDraft(s, "k", "   ");
    expect(s.size()).toBe(0);
    expect(readDraft(s, "k")).toBe("");
  });

  it("returns nothing for a key that was never written", () => {
    expect(readDraft(store(), "k")).toBe("");
  });

  it("drops a draft older than the TTL, and keeps one inside it", () => {
    const s = store();
    const then = 1_000_000;
    writeDraft(s, "k", "old", then);
    expect(readDraft(s, "k", then + DRAFT_TTL_MS - 1)).toBe("old");
    expect(readDraft(s, "k", then + DRAFT_TTL_MS + 1)).toBe("");
    expect(s.size()).toBe(0);
  });

  it("discards junk and the wrong shape rather than returning it", () => {
    const s = store({ a: "not json", b: JSON.stringify({ nope: 1 }), c: JSON.stringify({ body: 5, savedAt: 1 }) });
    for (const key of ["a", "b", "c"]) {
      expect(readDraft(s, key), key).toBe("");
    }
    expect(s.size()).toBe(0);
  });

  it("survives storage that throws on every call", () => {
    // Private-mode Safari and blocked site data both behave this way. The
    // comment still posts; only the draft is lost.
    expect(readDraft(angry, "k")).toBe("");
    expect(() => writeDraft(angry, "k", "x")).not.toThrow();
    expect(() => clearDraft(angry, "k")).not.toThrow();
  });
});

describe("clearDraft", () => {
  it("removes only that key", () => {
    const s = store();
    writeDraft(s, "a", "one");
    writeDraft(s, "b", "two");
    clearDraft(s, "a");
    expect(readDraft(s, "a")).toBe("");
    expect(readDraft(s, "b")).toBe("two");
  });
});
