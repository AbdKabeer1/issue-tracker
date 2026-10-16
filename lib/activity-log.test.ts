import { describe, expect, it } from "vitest";
import {
  activityCreateData,
  assigneeChangedSummary,
  commentedSummary,
  commentPreview,
  createdSummary,
  editedSummary,
  severityChangedSummary,
  statusChangedSummary,
} from "./activity-log";

describe("activity summary helpers", () => {
  it("summarizes ticket creation with truncated title", () => {
    const long = "A".repeat(100);
    expect(createdSummary("Login broken")).toBe(
      'created this ticket (“Login broken”)',
    );
    const summarized = createdSummary(long);
    expect(summarized).toContain("…");
    expect(summarized).not.toContain(long);
  });

  it("summarizes status and severity changes", () => {
    expect(statusChangedSummary("open", "resolved")).toBe(
      "changed status from Open to Resolved",
    );
    expect(severityChangedSummary("low", "critical")).toBe(
      "changed severity from Low to Critical",
    );
  });

  it("summarizes assignee changes including unassigned", () => {
    expect(assigneeChangedSummary(null, "Ada")).toBe(
      "changed assignee from Unassigned to Ada",
    );
    expect(assigneeChangedSummary("Ada", null)).toBe(
      "changed assignee from Ada to Unassigned",
    );
  });

  it("summarizes comments with truncation", () => {
    expect(commentedSummary("Looks good")).toBe(
      'added a comment: “Looks good”',
    );
    const long = "word ".repeat(40);
    expect(commentedSummary(long)).toContain("…");
  });

  it("shows comments as plain text without Markdown or user ids", () => {
    const body = "**Fixed** by @[Jane Doe](clx8k2abc000)";
    expect(commentedSummary(body)).toBe(
      "added a comment: “Fixed by @Jane Doe”",
    );
    expect(commentPreview(body)).toBe("Fixed by @Jane Doe");
    expect(commentPreview(body)).not.toContain("clx8k2abc000");
  });

  it("summarizes comments that use headings, quotes and task lists", () => {
    expect(commentPreview("## Root cause\n\n> not reproducible\n\n- [x] tested")).toBe(
      "Root cause not reproducible tested",
    );
  });

  it("summarizes edited fields", () => {
    expect(editedSummary([])).toBe("edited this ticket");
    expect(editedSummary(["title"])).toBe("edited title");
    expect(editedSummary(["title", "description"])).toBe(
      "edited title and description",
    );
    expect(editedSummary(["title", "description", "severity"])).toBe(
      "edited title, description, and severity",
    );
  });
});

describe("activityCreateData", () => {
  it("maps entries into Prisma createMany payloads", () => {
    const rows = activityCreateData([
      {
        bugId: "bug1",
        actorId: "user1",
        type: "status_changed",
        summary: "changed status from Open to Closed",
        metadata: { field: "status", from: "open", to: "closed" },
      },
      {
        bugId: "bug1",
        actorId: "user1",
        type: "commented",
        summary: "added a comment: “hi”",
      },
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      bugId: "bug1",
      actorId: "user1",
      type: "status_changed",
      metadata: { field: "status", from: "open", to: "closed" },
    });
    expect(rows[1].metadata).toBeUndefined();
  });
});
