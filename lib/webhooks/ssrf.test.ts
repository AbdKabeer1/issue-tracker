import { describe, expect, it } from "vitest";
import { checkSsrf } from "./ssrf";

// ---------------------------------------------------------------------------
// SSRF guard
// ---------------------------------------------------------------------------

describe("checkSsrf", () => {
  // Helper: override DNS resolution for tests.
  const resolve = (addr: string) => async () => [addr];

  it("rejects non-HTTPS URLs", async () => {
    const result = await checkSsrf("http://example.com/webhook", resolve("93.184.216.34"));
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toMatch(/HTTPS/);
  });

  it("rejects invalid URLs", async () => {
    const result = await checkSsrf("not-a-url", resolve("1.2.3.4"));
    expect(result.ok).toBe(false);
  });

  it("allows a valid external HTTPS URL", async () => {
    const result = await checkSsrf("https://example.com/webhook", resolve("93.184.216.34"));
    expect(result.ok).toBe(true);
  });

  // --- Private/reserved address blocks that must be blocked ---

  it.each([
    ["loopback IPv4", "127.0.0.1"],
    ["loopback IPv4 variant", "127.0.0.2"],
    ["private 10.x", "10.0.0.1"],
    ["private 172.16.x", "172.16.0.1"],
    ["private 172.31.x", "172.31.255.255"],
    ["private 192.168.x", "192.168.1.1"],
    ["link-local", "169.254.0.1"],
    ["cloud metadata", "169.254.169.254"],
    ["all-zeros network", "0.0.0.1"],
    ["shared address space", "100.64.0.1"],
  ])("blocks %s (%s)", async (_label, addr) => {
    const result = await checkSsrf("https://internal/webhook", resolve(addr));
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toMatch(/blocked address/i);
  });

  it("blocks IPv6 loopback", async () => {
    const result = await checkSsrf("https://internal/webhook", async () => ["::1"]);
    expect(result.ok).toBe(false);
  });

  it("blocks IPv6 link-local", async () => {
    const result = await checkSsrf("https://internal/webhook", async () => ["fe80::1"]);
    expect(result.ok).toBe(false);
  });

  it("blocks IPv6 unique-local (fc00::/7)", async () => {
    const result = await checkSsrf("https://internal/webhook", async () => ["fd00::1"]);
    expect(result.ok).toBe(false);
  });

  it("blocks IPv4-mapped IPv6 private", async () => {
    // ::ffff:10.0.0.1 maps to 10.0.0.1 which is private.
    const result = await checkSsrf("https://internal/webhook", async () => ["::ffff:10.0.0.1"]);
    expect(result.ok).toBe(false);
  });

  it.each(["::", "::ffff:7f00:1", "0:0:0:0:0:0:0:1", "64:ff9b::a00:1", "ff02::1", "2002:a00:1::", "2001:db8::1", "224.0.0.1", "255.255.255.255"])("blocks special-use and encoded IP %s", async (address) => {
    expect((await checkSsrf("https://endpoint.test", async () => [address])).ok).toBe(false);
  });

  it("checks IP literals without DNS and rejects mixed public/private answers", async () => {
    expect((await checkSsrf("https://[::ffff:127.0.0.1]/")).ok).toBe(false);
    expect((await checkSsrf("https://2130706433/")).ok).toBe(false);
    expect((await checkSsrf("https://endpoint.test", async () => ["93.184.216.34", "10.0.0.1"])).ok).toBe(false);
    expect((await checkSsrf("https://endpoint.test", async () => ["2606:4700:4700::1111"])).ok).toBe(true);
  });

  it("returns ok=false when DNS resolution fails", async () => {
    const result = await checkSsrf("https://nonexistent.invalid/webhook", async () => {
      throw new Error("NXDOMAIN");
    });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toMatch(/resolve/i);
  });

  it("returns the resolved address so the caller can connect to it directly", async () => {
    const result = await checkSsrf("https://example.com/webhook", resolve("93.184.216.34"));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.address).toBe("93.184.216.34");
  });
});
