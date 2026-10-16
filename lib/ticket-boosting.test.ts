import { describe, expect, it } from "vitest";
import { canBoostTicket, TICKET_BOOST_ERRORS } from "./ticket-boosting";

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
