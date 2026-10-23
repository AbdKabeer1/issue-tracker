// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { switchActiveRoleAction } from "@/app/actions/auth";
import { selectTenantAction } from "@/app/(app)/tenants/actions";
import { labelInNameMismatches } from "@/lib/a11y/label-in-name";
import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";

vi.mock("next/image", () => ({
  default: (props: { alt?: string }) => <span data-testid="img" aria-hidden={props.alt === ""} />,
}));

const navigation = vi.hoisted(() => ({ pathname: "/issues" }));
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
}));

vi.mock("@/app/(app)/tenants/actions", () => ({
  selectTenantAction: vi.fn(),
}));

vi.mock("@/app/actions/auth", () => ({
  switchActiveRoleAction: vi.fn(),
  logoutAction: vi.fn(),
}));

vi.mock("@/app/actions/settings", () => ({
  setThemeAction: vi.fn(),
}));

const switchRole = vi.mocked(switchActiveRoleAction);
const selectTenant = vi.mocked(selectTenantAction);

afterEach(() => cleanup());

beforeEach(() => {
  navigation.pathname = "/issues";
  switchRole.mockReset();
  switchRole.mockResolvedValue({ error: "refused" });
});

function renderHeader(props?: Partial<Parameters<typeof AppHeader>[0]>) {
  const shared = {
    userName: "Ada Lovelace",
    role: "super_admin" as const,
    isRealSuperAdmin: true,
    isRealAdmin: true,
    workspaces: [{ id: "t1", name: "Ziki", slug: "ziki" }],
    activeTenantId: "t1",
    ...props,
  };
  return render(
    <>
      <AppSidebar
        issueCount={4}
        workspaces={shared.workspaces ?? []}
        activeTenantId={shared.activeTenantId ?? null}
      />
      <AppHeader {...shared} />
    </>,
  );
}

describe("account menu role switch", () => {
  it("paints the sidebar navy and the top bar as a surface", () => {
    renderHeader();
    const header = document.querySelector("header");
    expect(header?.className).not.toContain("backdrop-blur");
    expect(header?.className).toContain("bg-zk-surface");
    expect(document.querySelector("aside")?.className).toContain("bg-deep-ocean");
    const account = screen.getByRole("button", { name: /account menu/i });
    // Wraps on phones (no sideways scroll at 360px), never squeezed from sm up.
    const toolbar = account.parentElement?.parentElement?.className.split(/\s+/) ?? [];
    expect(toolbar).toContain("min-w-0");
    expect(toolbar).toContain("sm:shrink-0");
  });

  it("opens the account menu and asks to switch the active role", async () => {
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole("button", { name: /account menu/i }));

    expect(screen.getByRole("group", { name: /view as/i })).toBeTruthy();
    await user.click(screen.getByRole("radio", { name: /normal user/i }));

    expect(switchRole).toHaveBeenCalledWith("user", `${window.location.pathname}${window.location.search}`);
  });

  it("keeps Overview and Issues in the sidebar", () => {
    renderHeader();
    expect(screen.getByRole("link", { name: "Overview" }).getAttribute("href")).toBe("/dashboard");
    expect(screen.getByRole("link", { name: /^Issues/ }).getAttribute("href")).toBe("/issues");
  });

  it("closes the Agents menu when a destination is chosen", async () => {
    const user = userEvent.setup();
    renderHeader();
    await user.click(screen.getByRole("button", { name: "Agents" }));
    expect(screen.getByRole("button", { name: "Agents" }).getAttribute("aria-expanded")).toBe("true");
    await user.click(screen.getByRole("link", { name: "Manage agents" }));
    expect(screen.getByRole("button", { name: "Agents" }).getAttribute("aria-expanded")).toBe("false");
  });

  it("renders Escalations as a link, with the pending count (#763)", () => {
    renderHeader({ pendingEscalationsCount: 5 });
    const link = screen.getByRole("link", { name: /escalation/i });
    expect(link.getAttribute("href")).toBe("/escalations");
    expect(screen.getAllByLabelText("5 pending").length).toBeGreaterThan(0);
  });

  it("does not put a Workspace menu in the bar", () => {
    renderHeader();
    expect(screen.queryByRole("button", { name: "Workspace" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Workspace" })).toBeNull();
  });

  it("shows this person's points in the bar", () => {
    renderHeader({ userId: "ada", points: 128, solvedTasks: 4 });
    const link = screen.getByRole("link", { name: /128 pts of 500, 4 solved/i });
    expect(link.getAttribute("href")).toBe("/users/ada");
    expect(link.textContent).toContain("128");
  });

  it("keeps each control's visible text inside its accessible name", () => {
    const { container } = renderHeader({
      userId: "ada",
      points: 0,
      solvedTasks: 0,
      unreadCount: 3,
      pendingEscalationsCount: 5,
    });
    expect(labelInNameMismatches(container)).toEqual([]);
    const workspace = screen.getByRole("button", { name: /active workspace, ziki/i });
    expect(workspace.getAttribute("aria-label")).toBeNull();
    expect(workspace.textContent).toContain("Ziki");
  });

  it("switches the active workspace as soon as one is chosen", async () => {
    const user = userEvent.setup();
    renderHeader({
      workspaces: [
        { id: "t1", name: "Ziki", slug: "ziki" },
        { id: "t2", name: "Acme", slug: "acme" },
      ],
      activeTenantId: "t1",
    });

    await user.click(screen.getByRole("button", { name: /active workspace, ziki/i }));
    await user.click(screen.getByRole("option", { name: "Acme" }));

    expect(selectTenant).toHaveBeenCalledTimes(1);
    const data = selectTenant.mock.calls[0][0] as FormData;
    expect(data.get("tenantId")).toBe("t2");
  });

  it("links to workspaces when the person has none", () => {
    renderHeader({ workspaces: [], activeTenantId: null });
    expect(screen.queryByRole("button", { name: /active workspace/i })).toBeNull();
    expect(screen.getByRole("link", { name: "Workspaces" }).getAttribute("href")).toBe("/tenants");
  });

  it("shows the slug when two workspaces share a name", async () => {
    const user = userEvent.setup();
    renderHeader({
      workspaces: [
        { id: "t1", name: "Acme", slug: "acme" },
        { id: "t2", name: "Acme", slug: "acme-eu" },
      ],
      activeTenantId: "t1",
    });
    const trigger = screen.getByRole("button", { name: /active workspace, acme \(acme\)/i });
    expect(trigger.getAttribute("aria-label")).toBeNull();
    await user.click(trigger);
    expect(screen.getByRole("option", { name: "Acme (acme)" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Acme (acme-eu)" })).toBeTruthy();
  });

  it("renders Docs & /llms.txt link in the account menu (#625)", async () => {
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole("button", { name: /account menu/i }));

    const docsLink = screen.getByRole("link", { name: /docs & \/llms\.txt/i });
    expect(docsLink).toBeTruthy();
    expect(docsLink.getAttribute("href")).toBe("/docs");
  });
});

describe("theme toggle in header (#659)", () => {
  it("renders the theme toggle button in the header toolbar", () => {
    renderHeader();
    const toggle = screen.getByTestId("theme-toggle");
    expect(toggle).toBeTruthy();
    expect(toggle.getAttribute("aria-label")).toMatch(/switch to (dark|light) mode/i);
  });

  it("renders the theme options in the account menu", async () => {
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole("button", { name: /account menu/i }));

    expect(screen.getByRole("group", { name: /theme preference/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Dark" })).toBeTruthy();
  });
});


describe("Profile account navigation (#576)", () => {
  it.each([
    ["/settings/profile", "Profile"],
    ["/settings", "Settings"],
    ["/settings/security", "Settings"],
  ])("marks only %s current in both account menus", async (pathname, currentLabel) => {
    navigation.pathname = pathname;
    const user = userEvent.setup();
    const { container } = renderHeader();

    for (const [buttonName, panelId] of [[/account menu/i, "account-menu"]] as const) {
      await user.click(screen.getByRole("button", { name: buttonName }));
      const panel = container.querySelector(`#${panelId}`)!;
      const profile = panel.querySelector('a[href="/settings/profile"]')!;
      const settings = panel.querySelector('a[href="/settings"]')!;
      expect(profile.textContent).toBe("Profile");
      expect(settings.textContent).toBe("Settings");
      expect(profile.getAttribute("aria-current")).toBe(currentLabel === "Profile" ? "page" : null);
      expect(settings.getAttribute("aria-current")).toBe(currentLabel === "Settings" ? "page" : null);
    }
  });
});
