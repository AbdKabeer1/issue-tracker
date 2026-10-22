/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FirstAgentEmptyState } from "./first-agent-empty-state";

describe("FirstAgentEmptyState (#434)", () => {
  it("renders the prominent guided headline", () => {
    render(<FirstAgentEmptyState />);
    expect(screen.getByText("Connect your first agent")).toBeTruthy();
    expect(document.querySelector('[aria-labelledby="first-agent-heading"]')).toBeTruthy();
  });

  it("walks the user through four concrete steps", () => {
    render(<FirstAgentEmptyState />);
    for (let i = 1; i <= 4; i++) {
      expect(document.querySelector(`[data-testid="first-agent-step-${i}"]`)).toBeTruthy();
    }
  });

  it("links to the connect flow, the approval page, and the agent API docs", () => {
    render(<FirstAgentEmptyState />);
    const cta = document.querySelector('[data-testid="first-agent-cta"]');
    expect(cta?.getAttribute("href")).toBe("/settings/agents/connect");
    const approvals = document.querySelector('[data-testid="first-agent-approvals"]');
    expect(approvals?.getAttribute("href")).toBe("/settings/agents/pair");
    const docs = document.querySelector('[data-testid="first-agent-docs"]');
    expect(docs?.getAttribute("href")).toBe("/llms.txt");
  });
});
