import { describe, expect, it } from "vitest";
import { mineFilterWhere, parseMineFilter } from "./mine-filter";

describe("parseMineFilter", () => {
  it("accepts the two options, case-insensitively", () => {
    expect(parseMineFilter("assigned")).toBe("assigned");
    expect(parseMineFilter(" Reported ")).toBe("reported");
  });

  it("uses the first value when the parameter is repeated", () => {
    expect(parseMineFilter(["reported", "assigned"])).toBe("reported");
  });

  it("ignores anything else", () => {
    expect(parseMineFilter(undefined)).toBeNull();
    expect(parseMineFilter("")).toBeNull();
    expect(parseMineFilter("everyone")).toBeNull();
  });
});

describe("mineFilterWhere", () => {
  it("filters by assignee or reporter", () => {
    expect(mineFilterWhere("assigned", "u1")).toEqual({ assigneeId: "u1" });
    expect(mineFilterWhere("reported", "u1")).toEqual({ reporterId: "u1" });
  });

  it("does nothing without a filter or a user", () => {
    expect(mineFilterWhere(null, "u1")).toEqual({});
    expect(mineFilterWhere("assigned", undefined)).toEqual({});
  });
});
