import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(path.resolve(__dirname, "page.tsx"), "utf8");

describe("Bug detail header responsive layout (#698)", () => {
  it("renders a compact mobile action row pinned directly under the title before badges and votes", () => {
    expect(pageSource).toMatch(
      /<h1[\s\S]*?<\/h1>[\s\S]*?data-testid="mobile-actions-row"[\s\S]*?Badge[\s\S]*?<VoteButton/
    );

    const mobileRowMatch = pageSource.match(
      /data-testid="mobile-actions-row"[\s\S]*?className="([^"]+)"/
    );
    expect(mobileRowMatch).toBeTruthy();
    const mobileClasses = mobileRowMatch![1];
    expect(mobileClasses).toContain("overflow-x-auto");
    expect(mobileClasses).toContain("sm:hidden");
    expect(mobileClasses).toContain("flex");
    expect(mobileClasses).toContain("gap-2");
  });

  it("includes SelfAssignButton in the header action row so Assign is immediately reachable", () => {
    expect(pageSource).toMatch(
      /headerActions[\s\S]*?canSelfAssign[\s\S]*?<SelfAssignButton/
    );
  });

  it("keeps status and severity visible at every width, folding only supplementary workflow badges into +N", () => {
    expect(pageSource).toMatch(
      /issueStatusChipClass\[bug\.status\][\s\S]*?issueSeverityChipClass\[bug\.severity\]/
    );

    expect(pageSource).toMatch(
      /<details className="group sm:contents">[\s\S]*?<summary[\s\S]*?\+\{extraBadgeCount\}[\s\S]*?<\/summary>/
    );
    expect(pageSource).toMatch(
      /const extraBadgeCount =[\s\S]*?isBoosted[\s\S]*?volunteerCount/
    );

    const contentsSpan = pageSource.match(
      /<span className="contents">([\s\S]*?)<\/span>\s*<\/details>/
    );
    expect(contentsSpan).toBeTruthy();
    expect(contentsSpan![1]).not.toMatch(/bug\.type|bug\.category|voteCount/);
  });

  it("anchors the desktop action cluster to the title's top edge (#687, #451)", () => {
    expect(pageSource).toContain(
      '<div className="flex shrink-0 flex-wrap items-center gap-2 self-start print:hidden">'
    );
    expect(pageSource).toContain("Back to issues");

    expect(pageSource).toMatch(/Danger zone[\s\S]*?<DeleteIssueButton/);
  });

  it("places an accessible back link to the issues list (#451)", () => {
    expect(pageSource).toMatch(
      /href="\/issues"[\s\S]*?aria-label="Back to issues"/
    );
  });
});

describe("Bug detail header hierarchy (#687)", () => {
  it("keeps workflow badges and taxonomy on separate rows", () => {
    expect(pageSource).toMatch(
      /flex flex-wrap items-center gap-2[\s\S]*?issueSeverityChipClass\[bug\.severity\][\s\S]*?<\/div>[\s\S]*?text-xs text-zk-muted[\s\S]*?bug\.type\.name[\s\S]*?bug\.category\.name/
    );
  });

  it("drops the redundant score pill so only VoteButton shows the vote total", () => {
    expect(pageSource).not.toMatch(/score \(\{/);
    expect(pageSource).not.toMatch(/\{bug\.voteCount\} score/);
  });

  it("uses a main column and side rail layout", () => {
    expect(pageSource).toContain("flex-[999_1_600px]");
    expect(pageSource).toContain("flex-[1_1_340px]");
    expect(pageSource).toContain("IssueSectionTabs");
  });
});
