import { describe, expect, it } from "vitest";
import { formatIssueNumber, parseIssueNumberQuery } from "./issue-number";

describe("formatIssueNumber", () => {
  it("writes the reference the way people say it", () => {
    expect(formatIssueNumber(1)).toBe("#1");
    expect(formatIssueNumber(4821)).toBe("#4821");
  });
});

describe("parseIssueNumberQuery", () => {
  it("accepts a bare number and a hashed one", () => {
    expect(parseIssueNumberQuery("42")).toBe(42);
    expect(parseIssueNumberQuery("#42")).toBe(42);
    expect(parseIssueNumberQuery("  #42  ")).toBe(42);
  });

  it("ignores ordinary text, including text that merely contains a number", () => {
    expect(parseIssueNumberQuery("login")).toBeNull();
    expect(parseIssueNumberQuery("issue 42")).toBeNull();
    expect(parseIssueNumberQuery("42px")).toBeNull();
    expect(parseIssueNumberQuery("#")).toBeNull();
    expect(parseIssueNumberQuery("")).toBeNull();
  });

  it("rejects zero and negatives, which no issue has", () => {
    expect(parseIssueNumberQuery("0")).toBeNull();
    expect(parseIssueNumberQuery("-3")).toBeNull();
  });

  it("rejects anything past a Postgres int4", () => {
    // Querying `number` with a bigger value makes the database throw rather
    // than return no rows, so it has to be treated as text.
    expect(parseIssueNumberQuery("2147483647")).toBe(2147483647);
    expect(parseIssueNumberQuery("2147483648")).toBeNull();
    expect(parseIssueNumberQuery("99999999999999999999")).toBeNull();
  });

  it("does not choke on a leading zero", () => {
    expect(parseIssueNumberQuery("007")).toBe(7);
  });
});
