import { describe, expect, it } from "vitest";
import { chainStageFor, parseSignalView, signalStageFor, workerStateFor } from "./signal-board";

describe("signalStageFor", () => {
  it("maps open intake stages", () => {
    expect(signalStageFor({ status: "open", intakeStage: "reported", hasActiveClaim: false, hasAssignee: false, hasPullRequest: false, hasTestVerdict: false, hasPendingMergeApproval: false })).toBe("report");
    expect(signalStageFor({ status: "open", intakeStage: "confirmed", hasActiveClaim: false, hasAssignee: false, hasPullRequest: false, hasTestVerdict: false, hasPendingMergeApproval: false })).toBe("confirm");
    expect(signalStageFor({ status: "open", intakeStage: "ready", hasActiveClaim: false, hasAssignee: false, hasPullRequest: false, hasTestVerdict: false, hasPendingMergeApproval: false })).toBe("plan");
  });
  it("maps build and verify", () => {
    expect(signalStageFor({ status: "in_progress", intakeStage: null, hasActiveClaim: true, hasAssignee: false, hasPullRequest: false, hasTestVerdict: false, hasPendingMergeApproval: false })).toBe("build");
    expect(signalStageFor({ status: "in_progress", intakeStage: null, hasActiveClaim: true, hasAssignee: false, hasPullRequest: true, hasTestVerdict: false, hasPendingMergeApproval: false })).toBe("verify");
    expect(signalStageFor({ status: "in_progress", intakeStage: null, hasActiveClaim: true, hasAssignee: false, hasPullRequest: false, hasTestVerdict: true, hasPendingMergeApproval: false })).toBe("verify");
    expect(signalStageFor({ status: "in_progress", intakeStage: null, hasActiveClaim: true, hasAssignee: false, hasPullRequest: false, hasTestVerdict: false, hasPendingMergeApproval: true })).toBe("verify");
  });
  it("maps ship and collapses the chain", () => {
    expect(signalStageFor({ status: "resolved", intakeStage: null, hasActiveClaim: false, hasAssignee: false, hasPullRequest: true, hasTestVerdict: true, hasPendingMergeApproval: false })).toBe("ship");
    expect(chainStageFor("report")).toBe("plan");
    expect(chainStageFor("confirm")).toBe("plan");
    expect(chainStageFor("plan")).toBe("plan");
    expect(chainStageFor("build")).toBe("build");
    expect(chainStageFor("verify")).toBe("verify");
    expect(chainStageFor("ship")).toBe("verify");
  });
  it("maps worker states and view params", () => {
    expect(workerStateFor({ online: true, waiting: false, activeClaim: true })).toBe("working");
    expect(workerStateFor({ online: true, waiting: true, activeClaim: false })).toBe("waiting");
    expect(workerStateFor({ online: true, waiting: false, activeClaim: false })).toBe("idle");
    expect(workerStateFor({ online: false, waiting: false, activeClaim: false })).toBe("offline");
    expect(parseSignalView("mine")).toBe("mine");
    expect(parseSignalView("nope")).toBe("all");
  });
});
