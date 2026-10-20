import { describe, expect, it, vi } from "vitest";

const redirects = vi.hoisted(() => ({ redirect: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: redirects.redirect }));

import QuestionsRedirect from "./page";
import QuestionIdRedirect from "./[id]/page";

describe("Legacy /questions redirects (#763)", () => {
  it("redirects /questions to /escalations", () => {
    QuestionsRedirect();
    expect(redirects.redirect).toHaveBeenCalledWith("/escalations");
  });

  it("redirects /questions/[id] to /escalations/[id]", async () => {
    await QuestionIdRedirect({ params: Promise.resolve({ id: "q-123" }) });
    expect(redirects.redirect).toHaveBeenCalledWith("/escalations/q-123");
  });
});
