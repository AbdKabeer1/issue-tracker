import { describe, expect, it } from "vitest";
import {
  MAX_COMMENT_DEPTH,
  buildCommentTree,
  commentDepth,
  truncateCommentBody,
  type FlatComment,
} from "./comments";

function comment(
  overrides: Partial<FlatComment> & Pick<FlatComment, "id">,
): FlatComment {
  return {
    body: "body",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    parentId: null,
    authorId: "author-1",
    author: { name: "Alice", role: "user" },
    parent: null,
    ...overrides,
  };
}

describe("buildCommentTree", () => {
  it("keeps flat root comments in order", () => {
    const roots = buildCommentTree([
      comment({ id: "c1", body: "first" }),
      comment({ id: "c2", body: "second" }),
    ]);

    expect(roots).toHaveLength(2);
    expect(roots.map((n) => n.id)).toEqual(["c1", "c2"]);
    expect(roots.every((n) => n.depth === 0 && n.children.length === 0)).toBe(
      true,
    );
  });

  it("nests replies under their parent with increasing depth", () => {
    const roots = buildCommentTree([
      comment({ id: "root", body: "root", author: { name: "Alice" } }),
      comment({
        id: "r1",
        body: "reply",
        parentId: "root",
        author: { name: "Bob" },
        parent: {
          id: "root",
          body: "root",
          author: { name: "Alice" },
        },
      }),
      comment({
        id: "r2",
        body: "nested",
        parentId: "r1",
        author: { name: "Carol" },
        parent: {
          id: "r1",
          body: "reply",
          author: { name: "Bob" },
        },
      }),
    ]);

    expect(roots).toHaveLength(1);
    expect(roots[0]?.children).toHaveLength(1);
    expect(roots[0]?.children[0]?.depth).toBe(1);
    expect(roots[0]?.children[0]?.children[0]?.depth).toBe(2);
    expect(roots[0]?.children[0]?.children[0]?.parent?.author.name).toBe("Bob");
  });

  it("treats orphaned replies as roots so flat history stays visible", () => {
    const roots = buildCommentTree([
      comment({
        id: "orphan",
        parentId: "missing",
        body: "still shows",
      }),
    ]);

    expect(roots).toHaveLength(1);
    expect(roots[0]?.id).toBe("orphan");
    expect(roots[0]?.depth).toBe(0);
  });
});

describe("commentDepth", () => {
  it("returns 0 for roots and walks parent links", () => {
    const parentById = new Map<string, string | null>([
      ["root", null],
      ["r1", "root"],
      ["r2", "r1"],
    ]);

    expect(commentDepth("root", parentById)).toBe(0);
    expect(commentDepth("r1", parentById)).toBe(1);
    expect(commentDepth("r2", parentById)).toBe(2);
  });

  it("caps walking past max depth", () => {
    const parentById = new Map<string, string | null>([
      ["a", null],
      ["b", "a"],
      ["c", "b"],
      ["d", "c"],
      ["e", "d"],
    ]);

    expect(commentDepth("e", parentById)).toBeLessThanOrEqual(
      MAX_COMMENT_DEPTH + 1,
    );
  });
});

describe("truncateCommentBody", () => {
  it("collapses whitespace and truncates long bodies", () => {
    expect(truncateCommentBody("  hello   world  ")).toBe("hello world");
    expect(truncateCommentBody("a".repeat(100), 10)).toBe(`${"a".repeat(9)}…`);
  });

  it("strips markdown before truncating reply previews", () => {
    expect(truncateCommentBody("see **bold** and [docs](https://x.com)")).toBe(
      "see bold and docs",
    );
  });

  it("strips editor markdown such as headings, quotes and task lists", () => {
    expect(
      truncateCommentBody("## Steps\n\n> expected\n\n- [x] done\n- [ ] todo"),
    ).toBe("Steps expected done todo");
  });
});
