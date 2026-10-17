import { describe, expect, it } from "vitest";
import {
  MAX_TOASTS,
  addToast,
  dismissToast,
  isRedirectError,
  nextToastId,
  type Toast,
} from "./toast-store";

const toast = (id: string, message = id): Toast => ({
  id,
  message,
  tone: "success",
});

describe("addToast", () => {
  it("appends to the end, so the newest is last", () => {
    const list = addToast([toast("a")], toast("b"));
    expect(list.map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("drops the oldest once the list is full", () => {
    let list: Toast[] = [];
    for (const id of ["a", "b", "c", "d", "e"]) list = addToast(list, toast(id));
    expect(list).toHaveLength(MAX_TOASTS);
    expect(list.map((t) => t.id)).toEqual(["c", "d", "e"]);
  });

  it("does not mutate the list it was given", () => {
    const original = [toast("a")];
    addToast(original, toast("b"));
    expect(original.map((t) => t.id)).toEqual(["a"]);
  });
});

describe("dismissToast", () => {
  it("removes only the matching toast", () => {
    const list = dismissToast([toast("a"), toast("b"), toast("c")], "b");
    expect(list.map((t) => t.id)).toEqual(["a", "c"]);
  });

  it("ignores an id that is already gone", () => {
    // Two timers can fire for the same toast if the user also clicks dismiss.
    const list = [toast("a")];
    expect(dismissToast(list, "gone").map((t) => t.id)).toEqual(["a"]);
  });
});

describe("nextToastId", () => {
  it("never repeats", () => {
    const ids = new Set(Array.from({ length: 50 }, nextToastId));
    expect(ids.size).toBe(50);
  });
});

describe("isRedirectError", () => {
  it("recognises the error Next throws for redirect()", () => {
    expect(isRedirectError({ digest: "NEXT_REDIRECT;replace;/bugs;307;" })).toBe(true);
  });

  it("says no to a real failure", () => {
    expect(isRedirectError(new Error("database is down"))).toBe(false);
    expect(isRedirectError({ digest: "NEXT_NOT_FOUND" })).toBe(false);
    expect(isRedirectError({ digest: 500 })).toBe(false);
  });

  it("says no to null and undefined rather than throwing", () => {
    expect(isRedirectError(null)).toBe(false);
    expect(isRedirectError(undefined)).toBe(false);
  });
});
