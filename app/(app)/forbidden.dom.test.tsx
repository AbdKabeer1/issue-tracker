// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import AppForbidden from "./forbidden";

describe("in-app 403 page (#567)", () => {
  beforeEach(() => cleanup());

  it("adds no <main> of its own, so the layout's <main> stays the only one", () => {
    render(
      <main id="main-content">
        <AppForbidden />
      </main>,
    );
    expect(screen.getAllByRole("main")).toHaveLength(1);
  });

  it("explains the 403 and offers a way back", () => {
    render(<AppForbidden />);
    expect(screen.getByRole("heading", { name: "You don't have access to this page" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to issues" })).toHaveAttribute("href", "/issues");
  });
});
