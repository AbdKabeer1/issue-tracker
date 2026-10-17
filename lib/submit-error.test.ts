import { describe, expect, it } from "vitest";
import { submitFailureMessage } from "./submit-error";

describe("submitFailureMessage", () => {
  it("tells an offline user to reconnect", () => {
    expect(submitFailureMessage(false)).toMatch(/offline/);
  });

  it("reassures an online user that their text is kept", () => {
    expect(submitFailureMessage(true)).toMatch(/still here/);
    expect(submitFailureMessage(true, "comment")).toMatch(/^Your comment/);
  });
});
