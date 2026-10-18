import { describe, expect, it } from "vitest";
import {
  daysUntil,
  dueDateValue,
  dueLabel,
  milestoneParamValue,
  milestoneProgress,
  milestoneWhere,
  parseDueDate,
  parseMilestoneFilter,
} from "./milestones";

describe("due dates", () => {
  it("parses a calendar day to UTC midnight and back", () => {
    const d = parseDueDate("2026-10-31");
    expect(d).toEqual(new Date("2026-10-31T00:00:00.000Z"));
    expect(dueDateValue(d as Date)).toBe("2026-10-31");
  });
  it("treats blank as no date and rejects nonsense", () => {
    expect(parseDueDate("")).toBeNull();
    expect(parseDueDate("2026-02-30")).toBe("invalid");
    expect(parseDueDate("31/10/2026")).toBe("invalid");
  });
  it("labels relative to the viewer's day", () => {
    expect(daysUntil("2026-10-20", "2026-10-18")).toBe(2);
    expect(dueLabel("2026-10-18", "2026-10-18")).toEqual({ text: "Due today", tone: "soon" });
    expect(dueLabel("2026-10-19", "2026-10-18").text).toBe("Due tomorrow");
    expect(dueLabel("2026-10-17", "2026-10-18")).toEqual({ text: "Overdue by 1 day", tone: "overdue" });
    expect(dueLabel("2026-11-30", "2026-10-18").tone).toBe("later");
    expect(dueLabel("2026-10-01", "2026-10-18", true)).toEqual({ text: "Closed", tone: "done" });
  });
});

describe("milestoneProgress", () => {
  it("is done over total, as a whole percent", () => {
    expect(milestoneProgress(1, 3)).toEqual({ done: 1, total: 3, percent: 33 });
    expect(milestoneProgress(0, 0)).toEqual({ done: 0, total: 0, percent: 0 });
    expect(milestoneProgress(5, 3).done).toBe(3);
  });
});

describe("milestone filter", () => {
  const known = [{ id: "m1" }];
  it("reads an id, none, or nothing", () => {
    expect(parseMilestoneFilter("m1", known)).toEqual({ id: "m1" });
    expect(parseMilestoneFilter("none", known)).toBe("none");
    expect(parseMilestoneFilter("gone", known)).toBeNull();
    expect(parseMilestoneFilter(undefined, known)).toBeNull();
  });
  it("builds the where and round-trips the param", () => {
    expect(milestoneWhere({ id: "m1" })).toEqual({ milestoneId: "m1" });
    expect(milestoneWhere("none")).toEqual({ milestoneId: null });
    expect(milestoneWhere(null)).toEqual({});
    expect(milestoneParamValue("none")).toBe("none");
    expect(milestoneParamValue({ id: "m1" })).toBe("m1");
  });
});
