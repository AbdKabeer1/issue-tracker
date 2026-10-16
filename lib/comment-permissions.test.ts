import { describe, expect, it } from "vitest";
import { canDeleteComment, canEditComment } from "./comment-permissions";

const mine = { authorId: "me" };
const theirs = { authorId: "them" };
const deleted = { authorId: "me", deletedAt: new Date() };

describe("canEditComment", () => {
  it("lets only the author edit", () => {
    expect(canEditComment("me", mine)).toBe(true);
    expect(canEditComment("me", theirs)).toBe(false);
    expect(canEditComment(undefined, mine)).toBe(false);
  });

  it("doesn't allow editing a deleted comment", () => {
    expect(canEditComment("me", deleted)).toBe(false);
  });
});

describe("canDeleteComment", () => {
  it("lets the author delete their own comment", () => {
    expect(canDeleteComment("me", "user", mine)).toBe(true);
  });

  it("lets admins and super admins delete anyone's comment", () => {
    expect(canDeleteComment("me", "admin", theirs)).toBe(true);
    expect(canDeleteComment("me", "super_admin", theirs)).toBe(true);
  });

  it("stops regular users deleting other people's comments", () => {
    expect(canDeleteComment("me", "user", theirs)).toBe(false);
  });

  it("refuses already-deleted comments and anonymous callers", () => {
    expect(canDeleteComment("me", "admin", deleted)).toBe(false);
    expect(canDeleteComment(undefined, "admin", theirs)).toBe(false);
  });
});
