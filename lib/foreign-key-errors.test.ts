import { describe, expect, it } from "vitest";
import {
  FOREIGN_KEY_ERRORS,
  getForeignKeyErrorMessage,
} from "./foreign-key-errors";

describe("getForeignKeyErrorMessage", () => {
  it("returns typeNotFound when field_name references type", () => {
    expect(getForeignKeyErrorMessage({ field_name: "typeId" })).toBe(
      FOREIGN_KEY_ERRORS.typeNotFound,
    );
    expect(
      getForeignKeyErrorMessage({ field_name: "Bug_typeId_fkey (index)" }),
    ).toBe(FOREIGN_KEY_ERRORS.typeNotFound);
  });

  it("returns categoryNotFound when field_name references category", () => {
    expect(getForeignKeyErrorMessage({ field_name: "categoryId" })).toBe(
      FOREIGN_KEY_ERRORS.categoryNotFound,
    );
    expect(
      getForeignKeyErrorMessage({ field_name: "Bug_categoryId_fkey (index)" }),
    ).toBe(FOREIGN_KEY_ERRORS.categoryNotFound);
  });

  it("returns assigneeNotFound when field_name references assignee", () => {
    expect(getForeignKeyErrorMessage({ field_name: "assigneeId" })).toBe(
      FOREIGN_KEY_ERRORS.assigneeNotFound,
    );
    expect(
      getForeignKeyErrorMessage({ field_name: "Bug_assigneeId_fkey (index)" }),
    ).toBe(FOREIGN_KEY_ERRORS.assigneeNotFound);
  });

  it("handles target array if provided instead of field_name", () => {
    expect(getForeignKeyErrorMessage({ target: ["typeId"] })).toBe(
      FOREIGN_KEY_ERRORS.typeNotFound,
    );
    expect(getForeignKeyErrorMessage({ target: ["categoryId"] })).toBe(
      FOREIGN_KEY_ERRORS.categoryNotFound,
    );
  });

  it("defaults to assigneeNotFound for missing or unknown fields", () => {
    expect(getForeignKeyErrorMessage()).toBe(
      FOREIGN_KEY_ERRORS.assigneeNotFound,
    );
    expect(getForeignKeyErrorMessage({})).toBe(
      FOREIGN_KEY_ERRORS.assigneeNotFound,
    );
    expect(getForeignKeyErrorMessage({ field_name: "unknown" })).toBe(
      FOREIGN_KEY_ERRORS.assigneeNotFound,
    );
  });
});
