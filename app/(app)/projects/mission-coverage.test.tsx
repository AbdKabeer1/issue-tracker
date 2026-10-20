/** @vitest-environment happy-dom */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("./actions", () => ({ createTestMissionAction: vi.fn() }));

import { MissionCoverage } from "./mission-coverage";

const missions = [{
  id: "mission-1",
  routePattern: "/settings/**",
  brief: "Check navigation and save behavior",
  role: "member" as const,
  viewport: "mobile_375" as const,
  lastCoveredAt: null,
  issuesFiled: 2,
}];

beforeEach(() => vi.clearAllMocks());

describe("MissionCoverage (#619)", () => {
  it("shows route, role, viewport, issue count, and uncovered status", () => {
    render(<MissionCoverage projectId="project-1" missions={missions} canManage={false} />);

    expect(screen.getByText("/settings/**")).toBeTruthy();
    expect(screen.getByText("Member")).toBeTruthy();
    expect(screen.getByText("375 px")).toBeTruthy();
    expect(screen.getByText("Never covered")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.queryByText("Add route missions")).toBeNull();
  });

  it("lets workspace admins configure route missions", () => {
    render(<MissionCoverage projectId="project-1" missions={missions} canManage />);

    expect(screen.getByText("Add route missions")).toBeTruthy();
    expect(screen.getByLabelText("Route pattern")).toBeTruthy();
    expect(screen.getByLabelText("Testing brief")).toBeTruthy();
    expect(screen.getByLabelText("Signed out")).toBeTruthy();
    expect(screen.getByLabelText("375 px")).toBeTruthy();
  });
});
