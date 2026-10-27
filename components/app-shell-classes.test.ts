import { expect, it } from "vitest";
import { shellMainClass } from "./app-shell-classes";
import { PAGE_CONTAINER_CLASS } from "./page-container";

it("keeps the page container on normal pages", () => {
  expect(shellMainClass(false)).toContain(PAGE_CONTAINER_CLASS);
});
it("removes the max width and padding on the board", () => {
  const cls = shellMainClass(true);
  expect(cls).toContain("max-w-none");
  expect(cls).toContain("p-0");
  expect(cls).not.toContain("max-w-6xl");
});
