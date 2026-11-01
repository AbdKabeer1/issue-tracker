// @vitest-environment jsdom
"use client";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({
  regenerateAgentKeyAction: vi.fn(),
  revokeAgentAction: vi.fn(),
  deleteAgentAction: vi.fn(),
  setAgentAreaPreferencesAction: vi.fn(),
  setAgentBurstAction: vi.fn(),
  setAgentLevelAction: vi.fn(),
  createAgentAction: vi.fn(),
}));

vi.mock("./agent-controls", () => ({
  AgentControls: () => <div data-testid="agent-controls-mock">Agent Controls</div>,
}));

vi.mock("@/components/agent-key-copy", () => ({
  AgentKeyCopy: () => <button type="button">Copy</button>,
}));

vi.mock("@/components/agent-plan-review", () => ({
  AgentPlanReview: () => <div>Plan review mock</div>,
}));

import { ManageAgentsList, type ManageAgentItem } from "./manage-agents-list";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const mockAgents: ManageAgentItem[] = [
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
    gardenState: "idle",
    gardenActivity: "Standing by in garden",
    activeTask: null,
    apiKeys: [],
    areaPreferences: [],
  },
  {
    id: "agent-2",
    name: "Bug Triager",
    model: "GPT-4o",
    level: "triager",
    burst: false,
    burstUntil: null,
    createdAt: new Date().toISOString(),
    revokedAt: null,
    personal: false,
    currentProjectId: "proj-1",
    recent: true,
    gardenState: "idle",
    gardenActivity: "Standing by in garden",
    activeTask: null,
    apiKeys: [],
    areaPreferences: [],
  },
];

describe("ManageAgentsList View Switcher", () => {
  it("defaults to Garden view and allows switching to List view", () => {
    render(
      <ManageAgentsList
        agents={mockAgents}
        activeCount={2}
        maxActive={5}
        levels={["observer", "contributor", "triager", "reviewer"]}
        projects={[{ id: "proj-1", name: "Ziki Core" }]}
        areas={[]}
        now={new Date().toISOString()}
        canSetBurst={false}
      />,
    );

    // Initial default: Garden view is active
    expect(screen.getByText("Your Agent Garden")).toBeDefined();

    // Toggle to List view
    const listBtn = screen.getByRole("button", { name: /List/i });
    fireEvent.click(listBtn);

    // List view should be active, garden header should no longer be present
    expect(screen.queryByText("Your Agent Garden")).toBeNull();
    expect(screen.getAllByText("Messages and instructions").length).toBeGreaterThan(0);

    // Toggle back to Garden view
    const gardenBtn = screen.getByRole("button", { name: /Garden/i });
    fireEvent.click(gardenBtn);
    expect(screen.getByText("Your Agent Garden")).toBeDefined();
  });
});
