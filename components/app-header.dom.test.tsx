// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { switchActiveRoleAction } from "@/app/actions/auth";
import { AppHeader } from "./app-header";

vi.mock("next/image", () => ({
  default: (props: { alt?: string }) => <span data-testid="img" aria-hidden={props.alt === ""} />,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/issues",
}));

vi.mock("@/app/(app)/projects/actions", () => ({
  switchProjectAction: vi.fn(),
}));

vi.mock("@/app/actions/auth", () => ({
  switchActiveRoleAction: vi.fn(),
  logoutAction: vi.fn(),
}));

const switchRole = vi.mocked(switchActiveRoleAction);

afterEach(() => cleanup());

beforeEach(() => {
  switchRole.mockReset();
  switchRole.mockResolvedValue({ error: "refused" });
});

function renderHeader() {
  return render(
    <AppHeader
      {...{
        userName: "Ada Lovelace",
        role: "super_admin" as const,
        isRealSuperAdmin: true,
        isRealAdmin: true,
        projects: [{ id: "p1", name: "Ziki", slug: "ziki" }],
        activeProjectId: "p1",
      }}
    />,
  );
}

describe("account menu role switch", () => {
  it("keeps the account menu outside the blurred header layer", () => {
    renderHeader();
    const header = document.querySelector("header");
    expect(header?.className).not.toContain("backdrop-blur");
    const background = header?.querySelector(":scope > [aria-hidden='true']");
    expect(background?.className).toContain("backdrop-blur");
    const account = screen.getByRole("button", { name: /account menu/i });
    expect(account.parentElement?.parentElement?.className).toContain("shrink-0");
  });

  it("opens the account menu and asks to switch the active role", async () => {
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole("button", { name: /account menu/i }));

    expect(screen.getByRole("group", { name: /view as/i })).toBeTruthy();
    await user.click(screen.getByRole("radio", { name: /normal user/i }));

    expect(switchRole).toHaveBeenCalledWith("user", `${window.location.pathname}${window.location.search}`);
  });
});
