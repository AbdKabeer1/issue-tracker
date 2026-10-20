// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/app/actions/issues", () => ({
  editProofLinksAction: vi.fn(),
}));

import { EditableProofLinks } from "./editable-proof-links";

describe("EditableProofLinks (#745)", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders GitHub PR heading and empty state copy", () => {
    render(<EditableProofLinks bugId="b1" initialLinks={[]} canEdit={true} />);

    expect(screen.getByText("GitHub PR")).toBeTruthy();
    expect(screen.getByText("No GitHub PR attached to this report.")).toBeTruthy();
  });

  it("renders list of links when present", () => {
    render(
      <EditableProofLinks
        bugId="b1"
        initialLinks={["https://github.com/zedu/web/pull/123"]}
        canEdit={true}
      />
    );

    expect(screen.getByText("GitHub PR")).toBeTruthy();
    expect(screen.getByText("https://github.com/zedu/web/pull/123")).toBeTruthy();
  });
});
