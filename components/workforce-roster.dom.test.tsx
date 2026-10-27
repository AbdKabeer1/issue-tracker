// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { WorkforceRoster } from "./workforce-roster";
import type { SignalWorkforce } from "@/lib/signal-board";

afterEach(cleanup);

const workers: SignalWorkforce[] = [
  {
    id: "a1",
    name: "relay-04",
    kind: "bot",
    level: "contributor",
    state: "working",
    currentWork: "#1 Login button unresponsive",
    lastSeenAt: new Date().toISOString(),
  },
  {
    id: "a2",
    name: "tester-09",
    kind: "bot",
    level: "contributor",
    state: "offline",
    currentWork: null,
    lastSeenAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
];

it("renders the relay roster with real work and state", () => {
  const { container } = render(<WorkforceRoster workers={workers} />);
  expect(screen.getByText("relay-04")).toBeTruthy();
  expect(screen.getByText("#1 Login button unresponsive")).toBeTruthy();
  expect(screen.getAllByText(/working/i).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/offline/i).length).toBeGreaterThan(0);
  expect(container.textContent ?? "").not.toMatch(/pts|points|ranking|leaderboard/i);
});

it("links an offline worker to recovery", () => {
  render(<WorkforceRoster workers={workers} />);
  expect(screen.getByRole("link", { name: /reconnect tester-09/i }).getAttribute("href")).toBe(
    "/settings/agents",
  );
});
