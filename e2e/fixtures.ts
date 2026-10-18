import { test as base, expect, type Page } from "@playwright/test";
import { authFile, nameFor, widthOf, type Role, type Width } from "./users";

type Options = { as: Role | null };
type Fixtures = { width: Width; me: string; uniq: (label: string) => string };

/**
 * Fixture callbacks name their second argument `provide`, not Playwright's
 * usual `use`, so the React hooks lint rule doesn't mistake it for React's.
 *
 * `test.use({ as: "admin" })` signs a spec in as that role, at whichever
 * width the project is running. `as: null` starts signed out.
 */
export const test = base.extend<Fixtures & Options>({
  as: ["user", { option: true }],
  width: async ({}, provide, testInfo) => provide(widthOf(testInfo.project.name)),
  me: async ({ as, width }, provide) => provide(as ? nameFor(as, width) : ""),
  storageState: async ({ as, width }, provide) => provide(as ? authFile(as, width) : { cookies: [], origins: [] }),
  // Titles unique to this run, width and test, so parallel tests never
  // find each other's issues.
  uniq: async ({ width }, provide, testInfo) => {
    const stamp = `${Date.now().toString(36)}${testInfo.workerIndex}`;
    await provide((label: string) => `${label} ${width} ${stamp}`);
  },
});

export { expect };

/** Reports an issue through the form and returns its page URL. */
export async function reportIssue(page: Page, title: string, description = "Steps: open the page, click Save. Expected it to save; it shows a blank page.") {
  await page.goto("/bugs/new");
  await page.getByLabel("Title").fill(title);
  // The description is the Markdown editor's textarea.
  await page.locator("#description").fill(description);
  await page.getByRole("button", { name: "Create issue" }).click();
  await expect(page.getByRole("heading", { level: 1, name: new RegExp(escapeRe(title)) })).toBeVisible();
  return page.url();
}

export function escapeRe(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Fails if the page is wider than the screen: the #255-style regression. */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "page scrolls sideways").toBeLessThanOrEqual(1);
}
