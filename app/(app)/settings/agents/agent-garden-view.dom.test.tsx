// @vitest-environment jsdom
"use client";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AgentGardenView } from "./agent-garden-view";
import type { ManageAgentItem } from "./manage-agents-list";

vi.mock("@/components/agent-plan-review", () => ({
  AgentPlanReview: ({
    issueNumber,
    agentName,
    onAuthorize,
  }: {
    issueNumber: number;
    agentName: string;
    onAuthorize: () => void;
  }) => (
    <div data-testid="agent-plan-review-modal">
      <p>Reviewing Plan for #{issueNumber} by {agentName}</p>
      <button type="button" onClick={onAuthorize}>
        Authorize Plan
      </button>
    </div>
  ),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const sampleAgents: ManageAgentItem[] = [
  {
    id: "agent-1",
    name: "Doc Writer",
    model: "Claude 3.5 Sonnet",
    level: "contributor",
    burst: false,
    burstUntil: null,
    createdAt: new Date().toISOString(),
    revokedAt: null,
    personal: false,
    currentProjectId: "proj-1",
    recent: true,
    gardenState: "waiting",
    gardenActivity: "Waiting on your plan review",
    activeTask: {
      issueId: "bug-688",
      issueNumber: 688,
      issueTitle: "Integrate Agent Garden state visualization",
    },
    apiKeys: [
      {
        id: "key-1",
        prefix: "ziki_doc1",
        apiKey: "ziki_doc1_secret",
        projectId: "proj-1",
        projectName: "Ziki Core",
        lastUsedAt: new Date().toISOString(),
      },
    ],
    areaPreferences: [],
  },
  {
    id: "agent-2",
    name: "Bug Scout",
    model: "GPT-4o",
    level: "triager",
    burst: false,
    burstUntil: null,
    createdAt: new Date().toISOString(),
    revokedAt: null,
    personal: false,
    currentProjectId: "proj-1",
    recent: true,
    gardenState: "working",
    gardenActivity: "Working on #687",
    activeTask: {
      issueId: "bug-687",
      issueNumber: 687,
      issueTitle: "Automated regression testing",
    },
    apiKeys: [],
    areaPreferences: [],
  },
  {
    id: "agent-3",
    name: "Idle Observer",
    model: null,
    level: "observer",
    burst: false,
    burstUntil: null,
    createdAt: new Date().toISOString(),
    revokedAt: null,
    personal: true,
    currentProjectId: null,
    recent: false,
    gardenState: "idle",
    gardenActivity: "Resting in garden",
    activeTask: null,
    apiKeys: [],
    areaPreferences: [],
  },
];

describe("AgentGardenView", () => {
  it("renders garden header and active agent count", () => {
    render(<AgentGardenView agents={sampleAgents} />);
    expect(screen.getByText("Your Agent Garden")).toBeDefined();
    expect(screen.getByText("3 active")).toBeDefined();
    expect(screen.getByText("Your AI team, hard at work.")).toBeDefined();
  });

  it("renders character cards with their states and badges", () => {
    render(<AgentGardenView agents={sampleAgents} />);

    // Agent 1: waiting
    expect(screen.getByText("Doc Writer")).toBeDefined();
    expect(screen.getByText("Needs review")).toBeDefined();
    expect(screen.getByText("#688")).toBeDefined();
    expect(screen.getByText("Integrate Agent Garden state visualization")).toBeDefined();
    expect(screen.getByRole("button", { name: /Review Plan/i })).toBeDefined();

    // Agent 2: working
    expect(screen.getByText("Bug Scout")).toBeDefined();
    expect(screen.getByText("Working")).toBeDefined();
    expect(screen.getByText("#687")).toBeDefined();

    // Agent 3: idle
    expect(screen.getByText("Idle Observer")).toBeDefined();
    expect(screen.getByText("Idle")).toBeDefined();
    expect(screen.getByText("Resting in garden")).toBeDefined();
  });

  it("opens plan review modal when clicking Review Plan button", () => {
    render(<AgentGardenView agents={sampleAgents} />);

    expect(screen.queryByTestId("agent-plan-review-modal")).toBeNull();

    const reviewButton = screen.getByRole("button", { name: /Review Plan/i });
    fireEvent.click(reviewButton);

    expect(screen.getByTestId("agent-plan-review-modal")).toBeDefined();
    expect(
      screen.getByText("Reviewing Plan for #688 by Doc Writer"),
    ).toBeDefined();

    const closeBtn = screen.getByRole("button", { name: /Close review modal/i });
    fireEvent.click(closeBtn);

    expect(screen.queryByTestId("agent-plan-review-modal")).toBeNull();
  });
});
