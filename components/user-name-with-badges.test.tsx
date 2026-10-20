// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { UserNameWithBadges } from "./user-name-with-badges";

afterEach(() => cleanup());

describe("UserNameWithBadges (#578)", () => {
  it("renders plain user name when no agent attribution is provided", () => {
    render(<UserNameWithBadges name="Cara QA" userId="u1" />);
    expect(screen.getByText("Cara QA")).toBeTruthy();
    expect(screen.queryByText(/via/)).toBeNull();
  });

  it("renders agent attribution badge with accessible label when agentName is provided", () => {
    const { container } = render(
      <UserNameWithBadges name="Cara QA" userId="u1" agentName="cara_reviewer" />,
    );
    expect(screen.getByText("Cara QA")).toBeTruthy();
    expect(screen.getByText("via cara_reviewer")).toBeTruthy();
    expect(screen.getByText("agent")).toBeTruthy();

    const badge = container.querySelector('[aria-label="via cara_reviewer (agent)"]');
    expect(badge).toBeTruthy();
  });
});
