import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/app/actions/comments", () => ({
  deleteCommentAction: vi.fn(),
  updateCommentAction: vi.fn(),
  createCommentAction: vi.fn(),
}));

import { CommentThread } from "./comment-thread";
import type { CommentNode } from "@/lib/comments";

describe("CommentThread permalinks (#142)", () => {
  it("renders comment id, scroll-mt-24, and timestamp permalink anchor", () => {
    const comments: CommentNode[] = [
      {
        id: "c1",
        authorId: "u1",
        parentId: null,
        body: "First comment",
        createdAt: new Date("2026-10-16T12:00:00Z"),
        editedAt: null,
        deletedAt: null,
        depth: 0,
        author: {
          name: "Alice",
          role: "user",
        },
        parent: null,
        children: [],
      },
    ];

    const html = renderToStaticMarkup(
      createElement(CommentThread, {
        bugId: "b1",
        reporterId: "u1",
        comments,
        users: [{ id: "u1", name: "Alice" }],
      }),
    );

    expect(html).toContain('id="comment-c1"');
    expect(html).toContain("scroll-mt-24");
    expect(html).toContain('href="#comment-c1"');
  });
});
