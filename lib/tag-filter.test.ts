import { describe, expect, it } from "vitest";
import { MAX_TAGS, parseTagFilter, serializeTags, suggestTags, tagTypeIds } from "./tag-filter";

const types = [
  { id: "t1", name: "Design" },
  { id: "t2", name: "Fix" },
  { id: "t3", name: "Marketing" },
  { id: "t4", name: "Feat" },
  { id: "t5", name: "UX Research" },
];

describe("parseTagFilter", () => {
  it("maps names to known types, ignoring case, spaces and unknown names", () => {
    expect(parseTagFilter(" design ,MARKETING,nope", types).map((t) => t.id)).toEqual(["t1", "t3"]);
  });

  it("dedupes and accepts repeated params", () => {
    expect(parseTagFilter(["fix", "Fix,design"], types).map((t) => t.id)).toEqual(["t2", "t1"]);
  });

  it("is empty for a missing or blank param", () => {
    expect(parseTagFilter(undefined, types)).toEqual([]);
    expect(parseTagFilter(",,", types)).toEqual([]);
  });

  it("caps the number of tags", () => {
    const many = Array.from({ length: 15 }, (_, i) => ({ id: `x${i}`, name: `T${i}` }));
    expect(parseTagFilter(many.map((t) => t.name).join(","), many)).toHaveLength(MAX_TAGS);
  });
});

describe("serializeTags", () => {
  it("lowercases and joins", () => {
    expect(serializeTags(["Design", "Marketing"])).toBe("design,marketing");
    expect(serializeTags([])).toBe("");
  });
});

describe("serializeTags / parseTagFilter round-trip (#730)", () => {
  const commaTypes = [
    { id: "c1", name: "Research, Design" },
    { id: "c2", name: "Design" },
    { id: "c3", name: "Fix" },
  ];

  const ids = (raw: string) => parseTagFilter(raw, commaTypes).map((t) => t.id);

  it("keeps a type name containing a comma as exactly one selection", () => {
    const serialized = serializeTags(["Research, Design"]);
    expect(serialized).toBe("research%2C design");
    expect(ids(serialized)).toEqual(["c1"]);
  });

  it("round-trips a normal name unchanged", () => {
    expect(serializeTags(["Design"])).toBe("design");
    expect(ids(serializeTags(["Design"]))).toEqual(["c2"]);
  });

  it("round-trips multiple selected types, comma name included", () => {
    expect(ids(serializeTags(["Research, Design", "Fix"]))).toEqual(["c1", "c3"]);
    expect(ids(serializeTags(["Design", "Fix"]))).toEqual(["c2", "c3"]);
  });
});

describe("suggestTags", () => {
  it("suggests names starting with the query before names containing it", () => {
    expect(suggestTags(types, "f").map((t) => t.name)).toEqual(["Fix", "Feat"]);
    expect(suggestTags(types, "e").map((t) => t.name)).toEqual(["Design", "Marketing", "Feat", "UX Research"]);
  });

  it("accepts a leading # and skips selected tags", () => {
    expect(suggestTags(types, "#de").map((t) => t.name)).toEqual(["Design"]);
    expect(suggestTags(types, "de", ["design"])).toEqual([]);
  });

  it("suggests each name once, even if two types differ only in case", () => {
    expect(suggestTags([...types, { id: "t9", name: "fix" }], "fi").map((t) => t.id)).toEqual(["t2"]);
  });

  it("suggests nothing for an empty query", () => {
    expect(suggestTags(types, "  ")).toEqual([]);
  });
});

describe("tagTypeIds", () => {
  it("includes every type with the same name in any case", () => {
    const dupes = [...types, { id: "t9", name: "fix" }];
    const selected = parseTagFilter("fix", dupes);
    expect(tagTypeIds(selected, dupes).sort()).toEqual(["t2", "t9"]);
  });
});
