// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import Homepage from "./homepage";

vi.mock("@/components/theme-toggle", () => ({
  useTheme: () => ["system", vi.fn(), false],
  applyThemeClient: vi.fn(),
}));

describe("public homepage API documentation links (#631)", () => {
  afterEach(() => cleanup());

  it("sends visitors to the public machine-readable spec, not the sign-in-gated docs page", () => {
    render(<Homepage />);

    const documentationLinks = screen.getAllByRole("link", { name: /api spec|api specification/i });

    expect(documentationLinks).toHaveLength(3);
    for (const link of documentationLinks) {
      expect(link).toHaveAttribute("href", "/llms.txt");
      expect(link).toHaveAccessibleName(/llms\.txt|machine-readable/i);
    }
    expect(screen.queryByRole("link", { name: /api docs|api documentation/i })).not.toBeInTheDocument();
  });
});
