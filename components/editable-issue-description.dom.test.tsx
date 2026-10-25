// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/app/actions/issues", () => ({
  editBugContentAction: vi.fn(),
}));

vi.mock("@/components/markdown-editor", () => ({
  MarkdownEditor: () => null,
}));

import { EditableIssueDescription } from "./editable-issue-description";

afterEach(cleanup);

const base = {
  bugId: "bug_1",
  initialTitle: "Title",
  initialDescription: "Description body",
  canEdit: true,
  users: [],
};

describe("EditableIssueDescription heading row", () => {
  it("shows no date; the opened date is in the Status box", () => {
    const { container } = render(<EditableIssueDescription {...base} />);

    expect(container.querySelector("time")).toBeNull();
  });

  it("offers editing as an icon button on the heading row", () => {
    const { container, getByRole } = render(<EditableIssueDescription {...base} />);

    const headingRow = container.querySelector("section > div");
    const edit = getByRole("button", { name: "Edit description" });

    expect(headingRow).toContainElement(edit);
    expect(edit).toHaveTextContent("");
  });

  it("hides the edit button from people who can't edit", () => {
    const { queryByRole } = render(<EditableIssueDescription {...base} canEdit={false} />);

    expect(queryByRole("button", { name: "Edit description" })).toBeNull();
  });
});
