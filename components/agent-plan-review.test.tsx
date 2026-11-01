// @vitest-environment jsdom
import { describe, expect, it, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { AgentPlanReview } from "./agent-plan-review";

afterEach(() => {
  cleanup();
});

describe("AgentPlanReview", () => {
  it("renders the issue and proposal context cleanly", () => {
    render(
      <AgentPlanReview 
        issueNumber={1042}
        issueTitle="Race condition in event cursor"
        agentName="agent-sentinel"
        personName="henryuks"
      />
    );

    expect(screen.getByText("#1042")).toBeDefined();
    expect(screen.getByText("Race condition in event cursor")).toBeDefined();
    expect(screen.getByText("agent-sentinel")).toBeDefined();
    expect(screen.getByText("@henryuks")).toBeDefined();
  });

  it("handles authorization and directive injection", () => {
    let capturedDirective = "";
    render(
      <AgentPlanReview 
        onAuthorize={(dir) => { capturedDirective = dir; }}
      />
    );

    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Ensure Postgres 15 compatibility" } });

    const approveButton = screen.getByRole("button", { name: /Authorize & Dispatch/i });
    fireEvent.click(approveButton);

    expect(capturedDirective).toBe("Ensure Postgres 15 compatibility");
    expect(screen.getByText(/Dispatched to/i)).toBeDefined();
  });
});
