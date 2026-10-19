import { describe, expect, it } from "vitest";
import { MAX_BULK_IDS, validateBulk } from "./bulk-actions";

const ok = (result: ReturnType<typeof validateBulk>) => {
  if (!result.ok) throw new Error(`expected ok, got: ${result.error}`);
  return result;
};

describe("validateBulk", () => {
  it("accepts a selection and a change", () => {
    const result = ok(validateBulk(["a", "b"], { status: "resolved" }));
    expect(result.ids).toEqual(["a", "b"]);
    expect(result.change).toEqual({ status: "resolved" });
  });

  it("drops duplicate ids, so one issue is not updated twice", () => {
    expect(ok(validateBulk(["a", "a", "b"], { status: "open" })).ids).toEqual(["a", "b"]);
  });

  it("refuses an empty or non-array selection", () => {
    for (const bad of [[], ["", ""], "a", null, undefined, 7]) {
      const result = validateBulk(bad, { status: "open" });
      expect(result.ok, JSON.stringify(bad)).toBe(false);
    }
  });

  it("caps how many issues one change may touch", () => {
    const many = Array.from({ length: MAX_BULK_IDS + 1 }, (_, i) => `id${i}`);
    const result = validateBulk(many, { status: "open" });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain(String(MAX_BULK_IDS));

    const atLimit = Array.from({ length: MAX_BULK_IDS }, (_, i) => `id${i}`);
    expect(validateBulk(atLimit, { status: "open" }).ok).toBe(true);
  });

  it("refuses a change that would do nothing", () => {
    expect(validateBulk(["a"], {}).ok).toBe(false);
    expect(validateBulk(["a"], null).ok).toBe(false);
    expect(validateBulk(["a"], { status: "" }).ok).toBe(false);
  });

  it("rejects a status or severity that is not real", () => {
    expect(validateBulk(["a"], { status: "sideways" }).ok).toBe(false);
    expect(validateBulk(["a"], { severity: "spicy" }).ok).toBe(false);
  });

  it("ignores fields that are not bulk-editable", () => {
    // Anything outside BULK_FIELDS must never reach the update, or the
    // client decides which columns it may write.
    const result = validateBulk(["a"], {
      status: "open",
      isDeleted: "true",
      reporterId: "someone-else",
      voteCount: "9999",
    } as Record<string, string>);
    expect(ok(result).change).toEqual({ status: "open" });
  });

  it("clears the nullable fields on an empty value", () => {
    const result = ok(
      validateBulk(["a"], { typeId: "", categoryId: "", assigneeId: "" }),
    );
    expect(result.change).toEqual({
      typeId: null,
      categoryId: null,
      assigneeId: null,
    });
  });

  it("treats an empty status or severity as no change, not as clearing it", () => {
    // Those columns are NOT NULL; clearing them would fail at the database.
    const result = validateBulk(["a"], { status: "", severity: "", typeId: "" });
    expect(ok(result).change).toEqual({ typeId: null });
  });

  it("refuses a non-string value rather than coercing it", () => {
    expect(validateBulk(["a"], { status: 1 as unknown as string }).ok).toBe(false);
  });
});
