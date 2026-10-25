// @vitest-environment jsdom
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  currentTenantIdFor: vi.fn(),
  isTenantAdmin: vi.fn(),
  isAdmin: vi.fn(),
  disputesForMember: vi.fn(),
  entriesForMember: vi.fn(),
  openDisputes: vi.fn(),
}));

vi.mock("@/lib/auth-helpers", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/tenant-context", () => ({ currentTenantIdFor: mocks.currentTenantIdFor }));
vi.mock("@/lib/agents/membership", () => ({ isTenantAdmin: mocks.isTenantAdmin }));
vi.mock("@/lib/roles", () => ({ isAdmin: mocks.isAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/points/disputes", () => ({
  disputesForMember: mocks.disputesForMember,
  entriesForMember: mocks.entriesForMember,
  openDisputes: mocks.openDisputes,
}));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
    "aria-label"?: string;
    className?: string;
  }) => <a href={href} {...props}>{children}</a>,
}));
vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, className }: { children: ReactNode; className?: string }) => (
    <span className={className}>{children}</span>
  ),
}));
vi.mock("@/components/local-time", () => ({
  LocalTime: ({ date }: { date: Date }) => <time>{date.toISOString()}</time>,
}));
vi.mock("./dispute-controls", () => ({ DisputeControls: () => <div /> }));
vi.mock("./credit-awards-form", () => ({ CreditAwardsForm: () => <div /> }));

import PointsDisputesPage from "./page";

const entries = [
  { id: "entry-1", points: -10, role: "solver", bugNumber: 123, correctedAt: null },
  { id: "entry-2", points: 5, role: "reporter", bugNumber: null, correctedAt: null },
];

const focusableSelector =
  'a[href], area[href], button, input:not([type="hidden"]), select, textarea, iframe, [contenteditable="true"], [tabindex]:not([tabindex="-1"])';
const interactiveSelector =
  'a, area, button, input, select, textarea, iframe, [contenteditable="true"], [role="button"], [role="link"]';

describe("points disputes page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: "user-1", role: "user" });
    mocks.currentTenantIdFor.mockResolvedValue("tenant-1");
    mocks.isAdmin.mockReturnValue(false);
    mocks.isTenantAdmin.mockResolvedValue(false);
    mocks.disputesForMember.mockResolvedValue([]);
    mocks.openDisputes.mockResolvedValue([]);
    mocks.entriesForMember.mockResolvedValue(entries);
  });

  it("renders each dispute action as a distinct, standalone accessible link", async () => {
    render(await PointsDisputesPage());

    const entriesSection = screen.getByRole("heading", { name: "Your points entries" }).parentElement;
    expect(entriesSection).not.toBeNull();
    const disputeLinks = within(entriesSection!).getAllByRole("link", { name: /^Dispute entry for/ });
    const names = disputeLinks.map((link) => link.getAttribute("aria-label"));

    expect(names).toEqual([
      "Dispute entry for issue #123 (-10 pts, solver)",
      "Dispute entry for unlinked entry (+5 pts, reporter)",
    ]);
    expect(new Set(names).size).toBe(disputeLinks.length);

    for (const link of disputeLinks) {
      const row = link.closest("li");
      expect(row).not.toBeNull();
      const focusableActions = row?.querySelectorAll(focusableSelector);
      expect(focusableActions).toHaveLength(1);
      expect(focusableActions?.[0]).toBe(link);
      expect(within(row!).getAllByRole("link")).toHaveLength(1);
      expect(link.querySelectorAll(interactiveSelector)).toHaveLength(0);
      expect(row?.querySelectorAll("button")).toHaveLength(0);
    }
  });
});
