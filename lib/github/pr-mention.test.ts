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
    expect(pullRequestUrlFromComment(`delivery: ${PR}`, undefined, "delivery")).toBe(PR);
    expect(pullRequestUrlFromComment(`see ${PR}`)).toBeNull();
  });

  it("picks the first pull request in a list of links", () => {
    expect(firstPullRequestLink([
      "https://github.com/Zedu-Endor/issue-tracker/issues/423",
      PR,
    ])).toBe(PR);
    expect(firstPullRequestLink(["https://github.com/Zedu-Endor/issue-tracker/issues/423"])).toBeNull();
  });

  it("does not attach when the assignee merely mentions a pull request in prose (#636)", () => {
    expect(pullRequestAttachment({
      authorId: "opeyemi",
      assigneeId: "opeyemi",
      pullRequestUrl: null,
      proofLinks: [],
      body: `This is similar to PR ${PR} which fixed the login issue.`,
      type: "comment",
    })).toBeNull();
  });

  it("attaches a pull request when the assignee explicitly delivers it (#636)", () => {
    expect(pullRequestAttachment({
      authorId: "opeyemi",
      assigneeId: "opeyemi",
      pullRequestUrl: null,
      proofLinks: [],
      body: `Implementation ready: ${PR}`,
      type: "delivery",
    })).toEqual({ pullRequestUrl: PR, proofLinks: [PR] });

    expect(pullRequestAttachment({
      authorId: "opeyemi",
      assigneeId: "opeyemi",
      pullRequestUrl: null,
      proofLinks: [],
      body: "Shipped fix",
      metadata: { prUrl: PR },
    })).toEqual({ pullRequestUrl: PR, proofLinks: [PR] });
  });

  it("ignores non-assignees and does not overwrite existing pull requests (#636)", () => {
    expect(pullRequestAttachment({
      authorId: "someone-else",
      assigneeId: "opeyemi",
      pullRequestUrl: null,
      proofLinks: [],
      body: PR,
      type: "delivery",
    })).toBeNull();

    expect(pullRequestAttachment({
      authorId: "opeyemi",
      assigneeId: "opeyemi",
      pullRequestUrl: PR,
      proofLinks: [PR],
      body: "https://github.com/Zedu-Endor/issue-tracker/pull/999",
      type: "delivery",
    })).toBeNull();
  });
});
