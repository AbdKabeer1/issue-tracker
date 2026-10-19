import { describe, expect, it } from "vitest";
import {
  MAX_REWARDED_REVIEWERS,
  pointSourceKey,
  pointsProgress,
  REPORTER_POINTS,
  REVIEWER_POINTS,
  solverPoints,
  TARGET_POINTS,
  TARGET_SOLVED_TASKS,
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
    expect(MAX_REWARDED_REVIEWERS).toBe(2);
    expect(TARGET_POINTS).toBe(500);
    expect(TARGET_SOLVED_TASKS).toBe(20);
  });

  it("builds one source key per role, issue and person", () => {
    expect(pointSourceKey("solver", "bug-1", "user-1")).toBe("solver:bug-1:user-1");
    expect(pointSourceKey("reporter", "bug-1", "user-1")).toBe("reporter:bug-1:user-1");
    expect(pointSourceKey("reviewer", "bug-1", "user-1")).toBe("reviewer:bug-1:user-1");
    expect(pointSourceKey("solver", "bug-1", "user-2")).not.toBe(pointSourceKey("solver", "bug-1", "user-1"));
  });

  describe("progress toward 500 points and 20 solved tasks", () => {
    it("starts at zero", () => {
      expect(pointsProgress(0, 0)).toEqual({
        points: 0,
        solvedTasks: 0,
        pointsPercent: 0,
        solvedPercent: 0,
        targetMet: false,
      });
    });

    it("reports partial progress", () => {
      const progress = pointsProgress(250, 5);
      expect(progress.pointsPercent).toBe(50);
      expect(progress.solvedPercent).toBe(25);
      expect(progress.targetMet).toBe(false);
    });

    it("is not met with 500 points but fewer than 20 solved tasks", () => {
      // Nine critical fixes are 540 points, but the 20-task gate still holds.
      const progress = pointsProgress(540, 9);
      expect(progress.pointsPercent).toBe(100);
      expect(progress.targetMet).toBe(false);
    });

    it("is not met with 20 solved tasks but fewer than 500 points", () => {
      // Twenty low-severity fixes are only 300 points.
      expect(pointsProgress(300, 20).targetMet).toBe(false);
    });

    it("is met once both targets are reached", () => {
      expect(pointsProgress(500, 20).targetMet).toBe(true);
      expect(pointsProgress(800, 25)).toMatchObject({ pointsPercent: 100, solvedPercent: 100, targetMet: true });
    });

    it("never shows a negative percentage after a correction", () => {
      expect(pointsProgress(-10, 0).pointsPercent).toBe(0);
    });
  });
});
