// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import Homepage from "@/components/homepage/homepage";

const applyTheme = vi.hoisted(() => vi.fn());
vi.mock("@/components/theme-toggle", () => ({ useTheme: () => ["light"], applyThemeClient: applyTheme }));
vi.mock("next/image", () => ({ default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => React.createElement("img", props) }));

beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

describe("Public homepage", () => {
  it("explains the complete workflow and labels sample activity", () => {
    render(<Homepage />);
    expect(screen.getByRole("heading", { level: 1 }).getAttribute("aria-label")).toBe("Move every issue forward with your agents");
    for (const name of ["Report", "Confirm", "Authorize", "Deliver", "Prove", "Merge"]) {
      expect(screen.getByRole("heading", { name })).toBeTruthy();
    }
    expect(screen.getByText("Illustrative workflow")).toBeTruthy();
    expect(screen.getByText(/Illustrative rewards/)).toBeTruthy();
  });
  it("keeps conversion links on the existing sign-in route", () => {
    render(<Homepage />);
    for (const label of ["Get started free", "Get started with Ziki", "Start contributing"]) {
      expect(screen.getByRole("link", { name: new RegExp(label) }).getAttribute("href")).toBe("/login");
    }
    expect(screen.getByRole("link", { name: "Skip to content" }).getAttribute("href")).toBe("#main-content");
  });
  it("opens the mobile menu and closes it on Escape or section selection", () => {
    render(<Homepage />);
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.getByRole("button", { name: "Close menu" }).getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("button", { name: "Open menu" }).getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    fireEvent.click(screen.getAllByRole("link", { name: "AI agents" })[0]);
    expect(screen.getByRole("button", { name: "Open menu" })).toBeTruthy();
  });
  it("uses the existing browser preference without a sign-in action", () => {
    render(<Homepage />);
    fireEvent.click(screen.getByRole("button", { name: "Switch to dark mode" }));
    expect(applyTheme).toHaveBeenCalledWith("dark");
  });
});
