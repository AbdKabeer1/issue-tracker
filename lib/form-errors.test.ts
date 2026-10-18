import { describe, expect, it } from "vitest";
import { z } from "zod";
import { errorIdFor, fieldError, fieldErrorAttrs, fromZodError } from "./form-errors";

const schema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
});

describe("fromZodError", () => {
  it("keeps which field failed, not just the message", () => {
    const parsed = schema.safeParse({ title: "x", description: "long enough here" });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(fromZodError(parsed.error)).toEqual({
      error: "Title must be at least 3 characters",
      field: "title",
      fieldErrors: { title: "Title must be at least 3 characters" },
    });
  });

  it("reports every failing field for the summary, first one first", () => {
    const parsed = schema.safeParse({ title: "", description: "" });
    if (parsed.success) throw new Error("expected failure");
    const result = fromZodError(parsed.error);
    expect(result.field).toBe("title");
    expect(Object.keys(result.fieldErrors ?? {})).toEqual(["title", "description"]);
  });

  it("keeps the first message per field when a field fails twice", () => {
    const twice = z.object({ t: z.string().min(3, "too short").regex(/^a/, "must start with a") });
    const parsed = twice.safeParse({ t: "b" });
    if (parsed.success) throw new Error("expected failure");
    expect(fromZodError(parsed.error).fieldErrors).toEqual({ t: "too short" });
  });

  it("falls back to a form-level message when no field is named", () => {
    expect(fromZodError({ issues: [] }, "Invalid input")).toEqual({ error: "Invalid input" });
    expect(fromZodError({ issues: [{ path: [], message: "Whole form is wrong" }] })).toEqual({
      error: "Whole form is wrong",
    });
  });
});

describe("fieldError", () => {
  it("builds the same shape for a check that is not Zod's", () => {
    expect(fieldError("assigneeId", "Assignee not found")).toEqual({
      error: "Assignee not found",
      field: "assigneeId",
      fieldErrors: { assigneeId: "Assignee not found" },
    });
  });
});

describe("fieldErrorAttrs", () => {
  const errors = { title: "Too short" };

  it("marks the failing field invalid and points at its message", () => {
    expect(fieldErrorAttrs("report", "title", errors)).toEqual({
      "aria-invalid": true,
      "aria-describedby": errorIdFor("report", "title"),
    });
  });

  it("leaves every other field alone, so it is not announced as invalid", () => {
    expect(fieldErrorAttrs("report", "description", errors)).toEqual({});
    expect(fieldErrorAttrs("report", "title", undefined)).toEqual({});
  });

  it("namespaces ids by form, so two forms on a page do not collide", () => {
    expect(errorIdFor("a", "body")).not.toBe(errorIdFor("b", "body"));
  });
});
