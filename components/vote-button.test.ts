import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/app/actions/issues", () => ({
  toggleVoteAction: vi.fn(),
}));

import { VoteButton } from "./vote-button";

const countDisabled = (html: string) =>
  (html.match(/<button[^>]*disabled=""/g) ?? []).length;

describe("VoteButton read-only mode (#122)", () => {
  for (const size of ["sm", "md"] as const) {
    it(`keeps like/dislike enabled normally (${size})`, () => {
      const html = renderToStaticMarkup(
        createElement(VoteButton, { bugId: "b1", voteCount: 3, size }),
      );
      expect(countDisabled(html)).toBe(0);
    });

    it(`disables like and dislike but still shows counts on deleted issues (${size})`, () => {
      const html = renderToStaticMarkup(
        createElement(VoteButton, {
          bugId: "b1",
          voteCount: 3,
          likeCount: 3,
          dislikeCount: 0,
          size,
          readOnly: true,
        }),
      );
      expect(countDisabled(html)).toBe(2);
      expect(html).toContain("3");
    });
  }
});
