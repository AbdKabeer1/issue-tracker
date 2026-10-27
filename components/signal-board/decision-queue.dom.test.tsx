// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DecisionQueue } from "./decision-queue";
import type { SignalDecision } from "@/lib/signal-board";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

const decision: SignalDecision = {
  id: "d1",
  issueNumber: 12,
  issueTitle: "Feature: invite links for private workspaces",
  stage: "before_offer",
  ruleReason: "type: Feature",
  createdAt: new Date().toISOString(),
};

afterEach(cleanup);

describe("DecisionQueue", () => {
  beforeEach(() => {
    refresh.mockReset();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
  });

  it("approves through the real decision endpoint and refreshes", async () => {
    render(<DecisionQueue decisions={[decision]} canDecide />);
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/approvals/d1/decision"),
      expect.objectContaining({ method: "POST", body: JSON.stringify({ decision: "approved" }) }),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("warns that rejection stops the stage and does not promise a retry", async () => {
    render(<DecisionQueue decisions={[decision]} canDecide />);
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));

    expect(screen.getByText(/this stops the stage/i)).toBeTruthy();
    expect(screen.getByText(/will not retry automatically/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /reject anyway/i }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/approvals/d1/decision"),
      expect.objectContaining({ body: JSON.stringify({ decision: "rejected" }) }),
    );
  });

  it("hides the decision buttons for non-admins", () => {
    render(<DecisionQueue decisions={[decision]} canDecide={false} />);
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    expect(screen.getByText(/waiting for an owner or admin/i)).toBeTruthy();
  });
});
