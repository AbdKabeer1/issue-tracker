import { describe, expect, it } from "vitest";
import {
  DISPLAY_NAME_MAX,
  displayNameProblem,
  displayNameSchema,
  displayNameSchemaFor,
  normalizeDisplayName,
} from "./display-name";
import { signupSchema } from "./validations/issue";

describe("normalizeDisplayName", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeDisplayName("  Ada   Lovelace \n")).toBe("Ada Lovelace");
  });
  it("composes accents so the same name is stored one way", () => {
    expect(normalizeDisplayName("José")).toBe("José");
  });
});

describe("displayNameProblem", () => {
  it.each([
    ["Ada Lovelace", null],
    ["Ọlájídé Adébáyọ̀", null],
    ["李小龙", null],
    ["O'Brien-Smith Jr.", null],
    ["Sam 🙂", null],
    ["Adminah Okafor", null],
  ])("accepts %j", (name, expected) => {
    expect(displayNameProblem(name)).toBe(expected);
  });

  it("rejects blank and one-character names", () => {
    expect(displayNameProblem("")).toBe("blank");
    expect(displayNameProblem("    ")).toBe("blank");
    expect(displayNameProblem("\t\n")).toBe("blank");
    expect(displayNameProblem("A")).toBe("too-short");
  });

  it("counts characters, not UTF-16 units", () => {
    expect(displayNameProblem("😀")).toBe("too-short");
    expect(displayNameProblem("😀".repeat(DISPLAY_NAME_MAX))).toBeNull();
    expect(displayNameProblem("😀".repeat(DISPLAY_NAME_MAX + 1))).toBe("too-long");
  });

  it("rejects names that look blank or reorder the page", () => {
    expect(displayNameProblem("​​")).toBe("invisible"); // zero-width space
    expect(displayNameProblem("Ada‮lovelace")).toBe("invisible"); // right-to-left override
    expect(displayNameProblem("Ada\u0000")).toBe("invisible");
    expect(displayNameProblem("Ada⁦x")).toBe("invisible"); // isolate
  });

  it("rejects names that imitate the Admin badge, unless you are an admin", () => {
    for (const name of ["Sam (Admin)", "admin", "ADMIN Sam", "Site Administrator", "Super Admin", "super-admin", "★ Sam", "Sam ★"]) {
      expect(displayNameProblem(name), name).toBe("admin-lookalike");
      expect(displayNameProblem(name, { isAdmin: true }), name).toBeNull();
    }
  });

  it("doesn't flag ordinary names that merely contain the letters", () => {
    for (const name of ["Adminah Bello", "Cadmin Ray", "Padmini Rao"]) {
      expect(displayNameProblem(name), name).toBeNull();
    }
  });
});

describe("schemas", () => {
  it("returns the normalised name", () => {
    expect(displayNameSchema.parse("  Ada   L  ")).toBe("Ada L");
    expect(displayNameSchemaFor(true).parse("Sam (Admin)")).toBe("Sam (Admin)");
  });
  it("reports a readable message", () => {
    const r = displayNameSchemaFor(false).safeParse("Sam (Admin)");
    expect(r.success ? "" : r.error.issues[0].message).toMatch(/admin/i);
  });
  it("sign-up uses the same rules, so a blocked name can't be chosen there", () => {
    const base = { email: "a@x.dev", password: "password123", confirmPassword: "password123" };
    expect(signupSchema.safeParse({ ...base, name: "Sam (Admin)" }).success).toBe(false);
    expect(signupSchema.safeParse({ ...base, name: "  Sam  Lee " }).data?.name).toBe("Sam Lee");
    const bad = signupSchema.safeParse({ ...base, name: "​​" });
    expect(bad.success ? "" : bad.error.issues[0].path[0]).toBe("name");
  });
});
