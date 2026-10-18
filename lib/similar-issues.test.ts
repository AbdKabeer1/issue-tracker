import { describe, expect, it } from "vitest";
import { fallbackTerms, MIN_SCORE, normalizeQuery, pickSimilar, shouldSearch } from "./similar-issues";

const row = (id: string, score: number, voteCount = 0) => ({
  id,
  number: Number(id.replace(/\D/g, "")) || 1,
  title: id,
  status: "open" as const,
  voteCount,
  score,
});

describe("normalizeQuery / shouldSearch", () => {
  it("collapses whitespace and caps length", () => {
    expect(normalizeQuery("  Login   button\n broken ")).toBe("Login button broken");
    expect(normalizeQuery("x".repeat(500))).toHaveLength(200);
  });
  it("waits for enough of a title to compare", () => {
    expect(shouldSearch("Login")).toBe(false);
    expect(shouldSearch("........!!")).toBe(false);
    expect(shouldSearch("Login button")).toBe(true);
  });
});

describe("pickSimilar", () => {
  it("shows nothing when nothing is similar", () => {
    expect(pickSimilar([row("a1", MIN_SCORE - 0.01), row("b2", 0.1)])).toEqual([]);
  });
  it("keeps the best three, ties broken by votes", () => {
    const picked = pickSimilar([
      row("a1", 0.5, 1),
      row("b2", 0.9),
      row("c3", 0.5, 7),
      row("d4", 0.4),
      row("e5", 0.36),
    ]);
    expect(picked.map((p) => p.id)).toEqual(["b2", "c3", "a1"]);
    expect(picked[0]).not.toHaveProperty("score");
  });
  it("accepts scores Postgres returns as strings", () => {
    expect(pickSimilar([{ ...row("a1", 0), score: "0.8" as unknown as number }])).toHaveLength(1);
  });
});

describe("fallbackTerms", () => {
  it("keeps distinct words of four letters or more", () => {
    expect(fallbackTerms("The login button: login fails on iOS")).toEqual(["login", "button", "fails"]);
  });
});
