import { describe, expect, it } from "vitest";
import {
  MAX_REWARDED_REVIEWERS,
  confirmationReviewerSourceKey,
  CONFIRMATION_REVIEWER_POINTS,
  pointSourceKey,
  pointsProgress,
  REPORTER_POINTS,
  REVIEWER_POINTS,
  solverPoints,
  TARGET_POINTS,
} from "./rules";

describe("point rules (#428)", () => {
  it("awards solver points by severity", () => {
    expect(solverPoints("low")).toBe(15);
    expect(solverPoints("medium")).toBe(25);
    expect(solverPoints("high")).toBe(40);
    expect(solverPoints("critical")).toBe(60);
  });

  it("has the reporter, reviewer and target numbers from the epic", () => {
    expect(REPORTER_POINTS).toBe(5);
    expect(REVIEWER_POINTS).toBe(10);
    expect(CONFIRMATION_REVIEWER_POINTS).toBe(5);
    expect(MAX_REWARDED_REVIEWERS).toBe(2);
    expect(TARGET_POINTS).toBe(500);
  });

  it("builds one source key per role, issue and person", () => {
    expect(pointSourceKey("solver", "bug-1", "user-1")).toBe("solver:bug-1:user-1");
    expect(pointSourceKey("reporter", "bug-1", "user-1")).toBe("reporter:bug-1:user-1");
    expect(pointSourceKey("reviewer", "bug-1", "user-1")).toBe("reviewer:bug-1:user-1");
    expect(pointSourceKey("solver", "bug-1", "user-2")).not.toBe(pointSourceKey("solver", "bug-1", "user-1"));
    expect(confirmationReviewerSourceKey("bug-1", "user-1")).toBe("reviewer-confirm:bug-1:user-1");
    expect(confirmationReviewerSourceKey("bug-1", "user-1")).not.toBe(pointSourceKey("reviewer", "bug-1", "user-1"));
  });

  describe("progress toward 500 points", () => {
    it("starts at zero", () => {
      expect(pointsProgress(0, 0)).toEqual({
        points: 0,
        solvedTasks: 0,
        pointsPercent: 0,
        targetMet: false,
      });
    });

    it("reports partial progress", () => {
      const progress = pointsProgress(250, 5);
      expect(progress.pointsPercent).toBe(50);
      expect(progress.solvedTasks).toBe(5);
      expect(progress.targetMet).toBe(false);
    });

    it("is met at 500 points with no solved tasks", () => {
      const progress = pointsProgress(500, 0);
      expect(progress.pointsPercent).toBe(100);
      expect(progress.targetMet).toBe(true);
    });

    it("is not met below 500 points", () => {
      expect(pointsProgress(300, 20).targetMet).toBe(false);
    });

    it("stays met above 500 points", () => {
      expect(pointsProgress(800, 25)).toMatchObject({ pointsPercent: 100, targetMet: true });
    });

    it("never shows a negative percentage after a correction", () => {
      expect(pointsProgress(-10, 0).pointsPercent).toBe(0);
    });
  });
});
