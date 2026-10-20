import { describe, expect, it } from "vitest";
import { claimIssue } from "@/lib/agent-api/claim";

describe("direct agent claims", () => {
  it("cannot bypass offer selection and acceptance", async () => {
    await expect(claimIssue({} as never, "project-a", "issue-a", "person-a"))
      .rejects.toMatchObject({ status: 409, message: expect.stringContaining("Bid with POST /api/v1/issues/{id}/bid") });
  });
});
