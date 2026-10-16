import { describe, expect, it } from "vitest";
import { filterPeopleByName, normalizeName } from "./assignee-search";

const people = [
  { id: "1", name: "Alice Mentor" },
  { id: "2", name: "Bob Builder" },
  { id: "3", name: "Cara QA" },
  { id: "4", name: "José Ramírez" },
  { id: "5", name: "Mary Ann" },
];

const names = (query: string) => filterPeopleByName(people, query).map((p) => p.name);

describe("filterPeopleByName", () => {
  it("returns everyone, in order, for an empty or blank query", () => {
    expect(names("")).toEqual(people.map((p) => p.name));
    expect(names("   ")).toEqual(people.map((p) => p.name));
  });

  it("matches anywhere in the name, ignoring case", () => {
    expect(names("ARA")).toEqual(["Cara QA"]);
    expect(names("build")).toEqual(["Bob Builder"]);
  });

  it("ignores accents in both the name and the query", () => {
    expect(names("jose")).toEqual(["José Ramírez"]);
    expect(names("ramírez")).toEqual(["José Ramírez"]);
  });

  it("lists name and word starts before other matches", () => {
    // "Mary Ann" starts with "m", "Alice Mentor" has a word starting with "m",
    // and "José Ramírez" only contains one.
    expect(names("ma")).toEqual(["Mary Ann"]);
    expect(names("m")).toEqual(["Mary Ann", "Alice Mentor", "José Ramírez"]);
  });

  it("returns nothing when no one matches", () => {
    expect(names("zzz")).toEqual([]);
  });
});

describe("normalizeName", () => {
  it("lowercases, trims and strips accents", () => {
    expect(normalizeName("  ÉLodie ")).toBe("elodie");
  });
});
