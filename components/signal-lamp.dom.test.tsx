// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { SignalLamp } from "./signal-lamp";

afterEach(cleanup);

it("renders the state as text, not colour alone", () => {
  render(<SignalLamp state="working" />);
  expect(screen.getByText("working")).toBeTruthy();
});

it("renders the down state for an offline worker", () => {
  render(<SignalLamp state="offline" />);
  expect(screen.getByText("offline")).toBeTruthy();
});

it("accepts a custom label", () => {
  render(<SignalLamp state="waiting" label="needs you" />);
  expect(screen.getByText("needs you")).toBeTruthy();
});
