import { describe, expect, it, vi } from "vitest";
import { resolveBasePath, toAppPath } from "./base-path";

describe("resolveBasePath", () => {
  it("serves the canonical ziki.dev from the root (#424)", () => {
    expect(resolveBasePath({ AUTH_URL: "https://ziki.dev/api/auth" })).toBe("");
    expect(resolveBasePath({ NEXT_PUBLIC_SITE_URL: "https://ziki.dev" })).toBe("");
  });

  it("still serves the old issues.zedu.chat host from the root", () => {
    expect(
      resolveBasePath({
        AUTH_URL: "https://issues.zedu.chat/api/auth",
      }),
    ).toBe("");
  });

  it("returns empty string when no environment variables are set", () => {
    expect(resolveBasePath({})).toBe("");
  });

  it("respects explicit BASE_PATH environment variable", () => {
    expect(resolveBasePath({ BASE_PATH: "/bug-tracker" })).toBe("/bug-tracker");
    expect(resolveBasePath({ BASE_PATH: "" })).toBe("");
    expect(resolveBasePath({ BASE_PATH: "/" })).toBe("");
  });

  it("respects NEXT_PUBLIC_BASE_PATH environment variable", () => {
    expect(resolveBasePath({ NEXT_PUBLIC_BASE_PATH: "/custom" })).toBe(
      "/custom",
    );
  });

  it("returns /bug-tracker for legacy contributors URL when not overridden", () => {
    expect(
      resolveBasePath({
        AUTH_URL: "https://contributors.zedu.chat/bug-tracker/api/auth",
      }),
    ).toBe("/bug-tracker");
  });

  it("defaults to empty string for vercel domains even if URL contains bug-tracker in hostname or path", () => {
    expect(
      resolveBasePath({
        AUTH_URL: "https://bug-tracker-eight-theta.vercel.app",
      }),
    ).toBe("");
    expect(
      resolveBasePath({
        AUTH_URL: "https://bug-tracker-eight-theta.vercel.app/api/auth",
      }),
    ).toBe("");
  });
});

describe("toAppPath", () => {
  it("strips the legacy /bug-tracker prefix", () => {
    expect(toAppPath("/bug-tracker/issues")).toBe("/issues");
    expect(toAppPath("/bug-tracker/issues/42")).toBe("/issues/42");
    expect(toAppPath("/bug-tracker/bugs")).toBe("/bugs");
    expect(toAppPath("/bug-tracker/bugs/42")).toBe("/bugs/42");
    expect(toAppPath("/bug-tracker/api/auth/session")).toBe(
      "/api/auth/session",
    );
  });

  it("maps the bare basePath to the app root", () => {
    expect(toAppPath("/bug-tracker")).toBe("/");
    expect(toAppPath("/bug-tracker/")).toBe("/");
  });

  it("leaves app-relative paths untouched", () => {
    expect(toAppPath("/login")).toBe("/login");
    expect(toAppPath("/bugs")).toBe("/bugs");
  });

  it("does not strip lookalike prefixes", () => {
    expect(toAppPath("/bug-tracker-admin/bugs")).toBe(
      "/bug-tracker-admin/bugs",
    );
  });

  it("serves from the domain root when NEXT_PUBLIC_BASE_PATH is '/'", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/");
    const mod = await import("./base-path");
    expect(mod.BASE_PATH).toBe("");
    expect(mod.toAppPath("/bugs/42")).toBe("/bugs/42");
    expect(mod.toAppPath("/")).toBe("/");
    vi.unstubAllEnvs();
  });

  it("honours a custom sub-path", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "issues/");
    const mod = await import("./base-path");
    expect(mod.BASE_PATH).toBe("/issues");
    vi.unstubAllEnvs();
  });
});
