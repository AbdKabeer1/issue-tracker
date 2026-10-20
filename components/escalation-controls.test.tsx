// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  EscalationTypeBadge,
  QuickResolveButtons,
  EscalationAnswerForm,
} from "@/app/(app)/escalations/escalation-controls";
import { quickResolveEscalationAction } from "@/app/(app)/escalations/actions";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/app/(app)/escalations/actions", () => ({
  quickResolveEscalationAction: vi.fn(),
  answerEscalationAction: vi.fn(),
}));

afterEach(() => cleanup());

describe("EscalationTypeBadge (#763)", () => {
  it("renders distinct badge labels", () => {
    const { rerender } = render(<EscalationTypeBadge type="Blocker" />);
    expect(screen.getByText("Blocker")).toBeTruthy();

    rerender(<EscalationTypeBadge type="Work Authorization" />);
    expect(screen.getByText("Work Authorization")).toBeTruthy();

    rerender(<EscalationTypeBadge type="Human Approval" />);
    expect(screen.getByText("Human Approval")).toBeTruthy();
  });
});

describe("QuickResolveButtons (#763)", () => {
  it("triggers quick resolve action with approve", async () => {
    const user = userEvent.setup();
    const mockAction = vi.mocked(quickResolveEscalationAction);
    mockAction.mockResolvedValue({ ok: true });

    render(<QuickResolveButtons escalationId="esc-123" />);

    const approveBtn = screen.getByRole("button", { name: /approve & unblock/i });
    await user.click(approveBtn);

    expect(mockAction).toHaveBeenCalledWith("esc-123", "approve");
  });

  it("triggers quick resolve action with authorize", async () => {
    const user = userEvent.setup();
    const mockAction = vi.mocked(quickResolveEscalationAction);
    mockAction.mockResolvedValue({ ok: true });

    render(<QuickResolveButtons escalationId="esc-123" />);

    const authBtn = screen.getByRole("button", { name: /authorize work/i });
    await user.click(authBtn);

    expect(mockAction).toHaveBeenCalledWith("esc-123", "authorize");
  });
});

describe("EscalationAnswerForm (#763)", () => {
  it("renders textarea and submit button", () => {
    render(<EscalationAnswerForm escalationId="esc-456" />);

    expect(screen.getByPlaceholderText(/provide decision/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /send response/i })).toBeTruthy();
  });
});
