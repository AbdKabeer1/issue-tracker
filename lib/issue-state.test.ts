import { describe, expect, it } from "vitest";
import { isDone, resultCountText } from "./issue-state";

describe("isDone", () => {
  it("treats resolved and closed as finished", () => {
    expect(isDone("resolved")).toBe(true);
    expect(isDone("closed")).toBe(true);
  });

  it("treats anything still in flight as not done", () => {
    expect(isDone("open")).toBe(false);
    expect(isDone("in_progress")).toBe(false);
  });
});

describe("resultCountText", () => {
  it("names the status filter, so it is clear what is excluded", () => {
    expect(resultCountText(12, "open")).toBe("12 open issues");
    expect(resultCountText(1, "in_progress")).toBe("1 in progress issue");
  });

  it("stays plain with no status filter", () => {
    expect(resultCountText(32, null)).toBe("32 results");
    expect(resultCountText(1, null)).toBe("1 result");
  });
});
