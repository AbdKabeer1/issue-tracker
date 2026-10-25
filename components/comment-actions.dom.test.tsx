// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { CommentNode } from "@/lib/comments";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/app/actions/comments", () => ({
  deleteCommentAction: vi.fn(),
  updateCommentAction: vi.fn(),
  createCommentAction: vi.fn(),
}));
vi.mock("@/components/comment-form", () => ({ CommentForm: () => null }));

import { CommentThread } from "./comment-thread";

const comment: CommentNode = {
  id: "c1",
  authorId: "ann",
  parentId: null,
  body: "My own comment.",
  type: "comment",
  createdAt: new Date("2026-10-22T00:00:00Z"),
  depth: 0,
  author: { name: "Ann", role: "user" },
  parent: null,
  children: [],
};

afterEach(cleanup);

describe("comment actions (pencil)", () => {
  it("is a disclosure, not an ARIA menu, offering the viewer's Edit and Delete", () => {
    render(
      <CommentThread bugId="b1" issueUrl="https://example.com/issues/b1" reporterId="ann" users={[]} comments={[comment]} currentUserId="ann" />,
    );
    const pencil = screen.getByRole("button", { name: "Comment actions" });
    expect(pencil).not.toHaveAttribute("aria-haspopup");
    fireEvent.click(pencil);
    expect(pencil).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("closes on Escape and puts focus back on the pencil", () => {
    render(
      <CommentThread bugId="b1" issueUrl="https://example.com/issues/b1" reporterId="ann" users={[]} comments={[comment]} currentUserId="ann" />,
    );
    const pencil = screen.getByRole("button", { name: "Comment actions" });
    fireEvent.click(pencil);
    screen.getByRole("button", { name: "Edit" }).focus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(pencil).toHaveFocus();
  });
});
