import { describe, expect, it } from "vitest";
import { buildUserSearchWhere } from "./user-search";

describe("buildUserSearchWhere", () => {
  it("returns empty object when query is empty, undefined or whitespace", () => {
    expect(buildUserSearchWhere()).toEqual({});
    expect(buildUserSearchWhere(undefined)).toEqual({});
    expect(buildUserSearchWhere(null)).toEqual({});
    expect(buildUserSearchWhere("")).toEqual({});
    expect(buildUserSearchWhere("   ")).toEqual({});
  });

  it("builds OR query for name and email with case-insensitive contains", () => {
    const where = buildUserSearchWhere("alice");
    expect(where).toEqual({
      OR: [
        { name: { contains: "alice", mode: "insensitive" } },
        { email: { contains: "alice", mode: "insensitive" } },
      ],
    });
  });

  it("trims whitespace from search term", () => {
    const where = buildUserSearchWhere("  bob@example.com  ");
    expect(where).toEqual({
      OR: [
        { name: { contains: "bob@example.com", mode: "insensitive" } },
        { email: { contains: "bob@example.com", mode: "insensitive" } },
      ],
    });
  });

  it("escapes SQL LIKE wildcards % and _", () => {
    const where = buildUserSearchWhere("alice_doe%50");
    expect(where).toEqual({
      OR: [
        { name: { contains: "alice\\_doe\\%50", mode: "insensitive" } },
        { email: { contains: "alice\\_doe\\%50", mode: "insensitive" } },
      ],
    });
  });

  it("escapes backslashes", () => {
    const where = buildUserSearchWhere("test\\user");
    expect(where).toEqual({
      OR: [
        { name: { contains: "test\\\\user", mode: "insensitive" } },
        { email: { contains: "test\\\\user", mode: "insensitive" } },
      ],
    });
  });
});
