import { describe, expect, it } from "vitest";
import {
  canBoostTicket,
  shouldUnboostOnStatusChange,
  TICKET_BOOST_ERRORS,
} from "./ticket-boosting";

describe("canBoostTicket", () => {
  it("allows admins to boost tickets", () => {
    expect(canBoostTicket("admin")).toBe(true);
  });

  it("allows super admins to boost tickets", () => {
    expect(canBoostTicket("super_admin")).toBe(true);
  });

  it("denies regular users from boosting tickets", () => {
    expect(canBoostTicket("user")).toBe(false);
  });

  it("denies unauthenticated or missing roles", () => {
    expect(canBoostTicket(null)).toBe(false);
    expect(canBoostTicket(undefined)).toBe(false);
  });
});

describe("TICKET_BOOST_ERRORS", () => {
  it("has clear and descriptive messages for all failure states", () => {
    expect(TICKET_BOOST_ERRORS.unauthorized).toBe(
      "Only admins can boost issues",
    );
    expect(TICKET_BOOST_ERRORS.invalidId).toBe("Invalid issue ID");
    expect(TICKET_BOOST_ERRORS.notFound).toBe("Issue not found");
    expect(TICKET_BOOST_ERRORS.failed).toBe(
      "Could not update issue boost status. Please try again.",
    );
  });
});

describe("shouldUnboostOnStatusChange (#256)", () => {
  it.each(["resolved", "closed"])("unboosts a boosted issue moved to %s", (to) => {
    expect(shouldUnboostOnStatusChange({ isBoosted: true, from: "open", to })).toBe(true);
  });

  it.each(["open", "in_progress"])("keeps the boost when moved to %s", (to) => {
    expect(shouldUnboostOnStatusChange({ isBoosted: true, from: "resolved", to })).toBe(false);
  });

  it("does nothing for issues that aren't boosted", () => {
    expect(shouldUnboostOnStatusChange({ isBoosted: false, from: "open", to: "closed" })).toBe(false);
  });

  it("does nothing when the status isn't changing", () => {
    expect(shouldUnboostOnStatusChange({ isBoosted: true, from: "closed", to: "closed" })).toBe(false);
    expect(shouldUnboostOnStatusChange({ isBoosted: true, from: "open", to: undefined })).toBe(false);
  });
});
