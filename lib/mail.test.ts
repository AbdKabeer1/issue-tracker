import { afterEach, describe, expect, it, vi } from "vitest";
import { MailNotConfiguredError, canSendMail, sendMail, smtpConfigured } from "./mail";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("canSendMail", () => {
  it("is true when SMTP is configured, in any environment", () => {
    expect(canSendMail({ SMTP_HOST: "smtp.x", SMTP_FROM: "a@x", NODE_ENV: "production" })).toBe(true);
  });

  it("is true without SMTP outside production (console mailer)", () => {
    expect(canSendMail({ NODE_ENV: "development" })).toBe(true);
    expect(canSendMail({ NODE_ENV: "test" })).toBe(true);
  });

  it("is false in production without SMTP", () => {
    expect(canSendMail({ NODE_ENV: "production" })).toBe(false);
    expect(canSendMail({ SMTP_HOST: "smtp.x", NODE_ENV: "production" })).toBe(false);
  });

  it("needs both SMTP_HOST and SMTP_FROM to count as configured", () => {
    expect(smtpConfigured({ SMTP_HOST: "smtp.x" })).toBe(false);
    expect(smtpConfigured({ SMTP_HOST: "smtp.x", SMTP_FROM: "a@x" })).toBe(true);
  });
});

describe("sendMail without SMTP (#210)", () => {
  const message = { to: "a@x.dev", subject: "Reset", text: "https://x/reset-password?token=SECRET" };

  it("throws in production and never logs the message", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SMTP_HOST", "");
    vi.stubEnv("SMTP_FROM", "");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    await expect(sendMail(message)).rejects.toBeInstanceOf(MailNotConfiguredError);
    expect(info).not.toHaveBeenCalled();
  });

  it("prints to the console in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SMTP_HOST", "");
    vi.stubEnv("SMTP_FROM", "");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    await expect(sendMail(message)).resolves.toBeUndefined();
    expect(info).toHaveBeenCalledOnce();
  });
});
