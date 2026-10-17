import { test, expect, expectNoHorizontalScroll } from "./fixtures";

test.describe("admin screens", () => {
  test.use({ as: "admin" });

  test("adds a platform", async ({ page, uniq }) => {
    const name = uniq("Kiosk").slice(0, 40);
    await page.goto("/admin/categories");
    await page.getByLabel("New platform name").fill(name);
    await page.getByRole("button", { name: "Add platform" }).click();
    await expect(page.getByText(name).first()).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("adds an issue type", async ({ page, uniq }) => {
    const name = uniq("Docs").slice(0, 45);
    await page.goto("/admin/types");
    await page.getByRole("button", { name: "Add new type" }).click();
    await page.getByLabel("Name").fill(name);
    await page.getByRole("button", { name: "Create type" }).click();
    await expect(page.getByRole("cell", { name }).or(page.getByText(name)).first()).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("a normal user can't open them", async ({ browser, width }) => {
    const { authFile } = await import("./users");
    const context = await browser.newContext({ storageState: authFile("user", width) });
    const page = await context.newPage();
    await page.goto("/admin/categories");
    await expect(page).not.toHaveURL(/\/admin\/categories/);
    await context.close();
  });
});

test.describe("super admin", () => {
  test.use({ as: "super" });

  test("sees admin management", async ({ page }) => {
    await page.goto("/admin/users");
    await expect(page.getByRole("heading", { name: "Admin management" })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
