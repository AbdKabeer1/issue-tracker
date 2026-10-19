import { promises as dns } from "node:dns";
import { BlockList, isIP } from "node:net";

const blocked = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) blocked.addSubnet(network, prefix, "ipv4");
const publicV6 = new BlockList();
publicV6.addSubnet("2000::", 3, "ipv6");
for (const [network, prefix] of [["2001::", 23], ["2001:db8::", 32], ["2002::", 16], ["3fff::", 20]] as const) {
  blocked.addSubnet(network, prefix, "ipv6");
}

/** Fail closed on special-use, mapped IPv4, and non-global IPv6. */
export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !blocked.check(address, "ipv4");
  return family === 6 && publicV6.check(address, "ipv6") && !blocked.check(address, "ipv6");
}

export type SsrfCheckResult = { ok: true; address: string } | { ok: false; reason: string };

export async function checkSsrf(url: string, resolveOverride?: (host: string) => Promise<string[]>): Promise<SsrfCheckResult> {
  let parsed: URL;
  try { parsed = new URL(url); }
  catch { return { ok: false, reason: "URL is not valid." }; }
  if (parsed.protocol !== "https:") return { ok: false, reason: "Webhook URL must use HTTPS." };
  const host = parsed.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (parsed.username || parsed.password || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    return { ok: false, reason: "Credentials and local hostnames are not allowed." };
  }
  let addresses: string[];
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    addresses = isIP(host) ? [host] : await Promise.race([
      resolveOverride ? resolveOverride(host) : dns.lookup(host, { all: true }).then((rows) => rows.map((row) => row.address)),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("DNS timeout")), 3000); }),
    ]);
  } catch { return { ok: false, reason: `Could not resolve hostname: ${host}` }; }
  finally { clearTimeout(timer); }
  if (!addresses.length) return { ok: false, reason: `No addresses found for hostname: ${host}` };
  if (addresses.some((address) => !isPublicAddress(address))) return { ok: false, reason: "Webhook URL resolves to a blocked address." };
  return { ok: true, address: addresses[0] };
}
