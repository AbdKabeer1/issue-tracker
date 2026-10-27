// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SignalBoard } from "./signal-board";
import type { OperationsBrief, SignalChannel, SignalDecision, SignalWorkforce } from "@/lib/signal-board";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const brief: OperationsBrief = {
  openIssues: 24,
  autoResolved: 12,
  pendingDecisions: 3,
  automationPct: 82,
  highPriority: 4,
};

const channels: SignalChannel[] = [
  {
    id: "b1",
    number: 1,
    title: "Login button unresponsive on mobile Safari",
    status: "in_progress",
    severity: "high",
    voteCount: 3,
    commentCount: 1,
    worker: { id: "a1", name: "relay-04", kind: "bot" },
    stage: "build",
    chainStage: "build",
    state: "working",
    activity: "Reproducing on iOS 18",
    lastSignalAt: new Date().toISOString(),
    hasPendingApproval: false,
  },
];

const decisions: SignalDecision[] = [
  {
    id: "d1",
    issueNumber: 12,
    issueTitle: "Feature: invite links for private workspaces",
    stage: "before_offer",
    ruleReason: "type: Feature",
    createdAt: new Date().toISOString(),
  },
];

const workforce: SignalWorkforce[] = [
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

afterEach(cleanup);

describe("SignalBoard", () => {
  it("renders the full issues board and the decision queue", () => {
    render(
      <SignalBoard
        brief={brief}
        channels={channels}
        decisions={decisions}
        workforce={workforce}
        canDecide
        view="all"
      />,
    );

    expect(screen.getByText("All issues")).toBeTruthy();
    expect(screen.getByText("Login button unresponsive on mobile Safari")).toBeTruthy();
    expect(screen.getAllByText("3").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/decisions/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /view full manifest/i }).getAttribute("href")).toBe(
      "/issues?status=all&project=all",
    );
  });

  it("shows an offline worker with a recovery link", () => {
    render(
      <SignalBoard
        brief={brief}
        channels={channels}
        decisions={decisions}
        workforce={workforce}
        canDecide
        view="all"
      />,
    );

    expect(screen.getAllByText("tester-09").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/offline/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /reconnect/i }).getAttribute("href")).toBe("/settings/agents");
  });

  it("does not render points or ranking language", () => {
    const { container } = render(
      <SignalBoard
        brief={brief}
        channels={channels}
        decisions={decisions}
        workforce={workforce}
        canDecide
        view="all"
      />,
    );

    expect(container.textContent ?? "").not.toMatch(/pts|points|ranking|leaderboard/i);
  });
});
