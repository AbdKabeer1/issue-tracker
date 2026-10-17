import { describe, expect, it } from "vitest";
import {
  RESOLUTION_NOTE_MAX,
  activityNote,
  currentResolution,
  isFinishedStatus,
  parseResolutionNote,
} from "./resolution-note";

const act = (to: string, note?: string) => ({
  createdAt: new Date("2026-10-01"),
  metadata: { field: "status", from: "open", to, ...(note ? { note } : {}) },
  actor: { name: "Ada" },
});

describe("parseResolutionNote", () => {
  it("keeps a trimmed note on a change into resolved or closed", () => {
    expect(parseResolutionNote("  Fixed in 2.4 \n", { from: "open", to: "resolved" })).toEqual({ note: "Fixed in 2.4" });
    expect(parseResolutionNote("Won't fix", { from: "open", to: "closed" })).toEqual({ note: "Won't fix" });
  });
  it("drops the note when the change is not into a finished status", () => {
    expect(parseResolutionNote("x", { from: "open", to: "in_progress" })).toEqual({ note: null });
    expect(parseResolutionNote("x", { from: "resolved", to: "resolved" })).toEqual({ note: null });
    expect(parseResolutionNote("x", { from: "open", to: undefined })).toEqual({ note: null });
  });
  it("treats blank and non-string input as no note", () => {
    expect(parseResolutionNote("   \n ", { from: "open", to: "resolved" })).toEqual({ note: null });
    expect(parseResolutionNote(null, { from: "open", to: "resolved" })).toEqual({ note: null });
  });
  it("strips control and bidi characters but keeps newlines", () => {
    expect(parseResolutionNote("a\u0000b‮c\nd", { from: "open", to: "resolved" })).toEqual({ note: "abc\nd" });
  });
  it("rejects a note over the limit, counting code points", () => {
    expect("error" in parseResolutionNote("a".repeat(RESOLUTION_NOTE_MAX + 1), { from: "open", to: "resolved" })).toBe(true);
    expect(parseResolutionNote("😀".repeat(RESOLUTION_NOTE_MAX), { from: "open", to: "resolved" })).toEqual({ note: "😀".repeat(RESOLUTION_NOTE_MAX) });
  });
});

describe("currentResolution", () => {
  it("shows the note of the change that produced the current status", () => {
    expect(currentResolution("resolved", act("resolved", "Done"))?.note).toBe("Done");
  });
  it("hides it once the issue is reopened", () => {
    expect(currentResolution("open", act("resolved", "Done"))).toBeNull();
    expect(currentResolution("open", act("open"))).toBeNull();
  });
  it("hides a note belonging to a different finished status", () => {
    expect(currentResolution("closed", act("resolved", "Done"))).toBeNull();
  });
  it("returns null with no note or no activity", () => {
    expect(currentResolution("resolved", act("resolved"))).toBeNull();
    expect(currentResolution("resolved", null)).toBeNull();
  });
});

describe("helpers", () => {
  it("isFinishedStatus", () => {
    expect(isFinishedStatus("resolved")).toBe(true);
    expect(isFinishedStatus("open")).toBe(false);
  });
  it("activityNote reads only string notes", () => {
    expect(activityNote({ note: "hi" })).toBe("hi");
    expect(activityNote({ note: 3 })).toBeNull();
    expect(activityNote(null)).toBeNull();
  });
});
