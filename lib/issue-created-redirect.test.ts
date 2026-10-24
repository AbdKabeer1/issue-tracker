import { describe, expect, it } from "vitest";
import { isIssueCreatedRedirect } from "./issue-created-redirect";

function redirectTo(destination: string) {
  return { digest: `NEXT_REDIRECT;push;${destination};303;` };
}

describe("isIssueCreatedRedirect", () => {
  it("recognizes a redirect to a newly created issue", () => {
    expect(isIssueCreatedRedirect(redirectTo("/issues/583"))).toBe(true);
  });

  it("does not treat login or unrelated redirects as successful creation", () => {
    expect(isIssueCreatedRedirect(redirectTo("/login"))).toBe(false);
    expect(isIssueCreatedRedirect(redirectTo("/issues"))).toBe(false);
    expect(isIssueCreatedRedirect(redirectTo("/issues/583/edit"))).toBe(false);
  });

  it("rejects ordinary errors and malformed redirect digests", () => {
    expect(isIssueCreatedRedirect(new Error("Network unavailable"))).toBe(false);
    expect(isIssueCreatedRedirect({ digest: "NEXT_NOT_FOUND" })).toBe(false);
    expect(isIssueCreatedRedirect(null)).toBe(false);
  });
});
