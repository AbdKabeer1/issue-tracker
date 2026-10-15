import { describe, expect, it } from "vitest";
import { isHttpUrl, splitProofLinkLines } from "./proof-links";

describe("splitProofLinkLines", () => {
  it("returns empty array for blank input", () => {
    expect(splitProofLinkLines("")).toEqual([]);
    expect(splitProofLinkLines("   \n  ")).toEqual([]);
    expect(splitProofLinkLines(undefined)).toEqual([]);
  });

  it("splits and trims newline-separated URLs", () => {
    expect(
      splitProofLinkLines(
        " https://example.com/a.png \n\nhttps://example.com/b.mp4\n",
      ),
    ).toEqual(["https://example.com/a.png", "https://example.com/b.mp4"]);
  });
});

describe("isHttpUrl", () => {
  it("accepts http and https URLs", () => {
    expect(isHttpUrl("https://cdn.example.com/shot.png")).toBe(true);
    expect(isHttpUrl("http://localhost:3000/clip.webm")).toBe(true);
  });

  it("rejects non-http schemes and invalid strings", () => {
    expect(isHttpUrl("ftp://files.example.com/a")).toBe(false);
    expect(isHttpUrl("not-a-url")).toBe(false);
  });
});
