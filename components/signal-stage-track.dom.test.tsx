// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { SignalStageTrack } from "./signal-stage-track";

afterEach(cleanup);

it("renders the six-stage track and marks the active stage", () => {
  render(<SignalStageTrack stage="build" />);
  for (const label of ["Report", "Confirm", "Plan", "Build", "Verify", "Ship"]) {
    expect(screen.getByText(label)).toBeTruthy();
  }
  expect(screen.getByText("Build").closest("li")?.getAttribute("aria-current")).toBe("step");
});
