import { describe, expect, it } from "vitest";
import { DELETE, GET, OPTIONS, PATCH, POST, PUT } from "./route";

describe("unknown agent API routes", () => {
  it.each([
    ["GET", GET],
    ["POST", POST],
    ["PUT", PUT],
    ["PATCH", PATCH],
    ["DELETE", DELETE],
    ["OPTIONS", OPTIONS],
  ])("returns a JSON 404 for %s", async (method, handler) => {
    const response = handler();

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toMatchObject({ error: "not_found" });
  });
});
