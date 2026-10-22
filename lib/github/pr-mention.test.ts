import { describe, expect, it } from "vitest";
import { firstPullRequestLink, firstPullRequestUrl, pullRequestAttachment, pullRequestUrlFromComment } from "@/lib/github/pr-mention";

const PR = "https://github.com/Zedu-Endor/issue-tracker/pull/1230";

describe("pull request mentions", () => {
  it("reads a pull request url out of a sentence", () => {
    expect(firstPullRequestUrl(`Implementation ready: ${PR} (fix/423).`)).toBe(PR);
  });

  it("ignores a GitHub issue url", () => {
    expect(firstPullRequestUrl("https://github.com/Zedu-Endor/issue-tracker/issues/423")).toBeNull();
  });

  it("prefers a comment's prUrl over the body", () => {
    expect(pullRequestUrlFromComment("shipped", { prUrl: PR })).toBe(PR);
    expect(pullRequestUrlFromComment(`see ${PR}`)).toBe(PR);
  });

  it("picks the first pull request in a list of links", () => {
    expect(firstPullRequestLink([
      "https://github.com/Zedu-Endor/issue-tracker/issues/423",
      PR,
    ])).toBe(PR);
    expect(firstPullRequestLink(["https://github.com/Zedu-Endor/issue-tracker/issues/423"])).toBeNull();
  });

  it("attaches a pull request mentioned by the assignee, and ignores everyone else", () => {
    expect(pullRequestAttachment({
      authorId: "opeyemi",
      assigneeId: "opeyemi",
      pullRequestUrl: null,
      proofLinks: [],
      body: `Implementation ready: ${PR}`,
    })).toEqual({ pullRequestUrl: PR, proofLinks: [PR] });
    expect(pullRequestAttachment({
      authorId: "someone-else",
      assigneeId: "opeyemi",
      pullRequestUrl: null,
      proofLinks: [],
      body: PR,
    })).toBeNull();
    expect(pullRequestAttachment({
      authorId: "opeyemi",
      assigneeId: "opeyemi",
      pullRequestUrl: PR,
      proofLinks: [PR],
      body: "https://github.com/Zedu-Endor/issue-tracker/pull/999",
    })).toBeNull();
  });
});
