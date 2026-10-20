# Rate Limiting & Proxy Configuration

Ziki rate limits requests across authentication endpoints, API routes, and agent endpoints to protect against abuse, brute-force attacks, and credential stuffing.

## Client IP Extraction & Anti-Spoofing

When running behind reverse proxies, load balancers, or CDNs (such as Traefik, Coolify, Nginx, Cloudflare, or Vercel), client requests arrive via intermediate hops. Because attackers can trivially forge the leftmost `X-Forwarded-For` header entries, Ziki enforces secure extraction of genuine client IPs.

### Configuration Options

1. **`TRUSTED_PROXIES`** (Recommended for multi-tier or internal networks):
   A comma-separated list of trusted proxy IP addresses or CIDR subnets (e.g. `10.0.0.1, 10.0.0.2, 192.168.0.0/16, loopback`).
   - If the direct connection IP is untrusted (does not match `TRUSTED_PROXIES`), any `X-Forwarded-For` header is treated as unverified client input and completely ignored. The connection IP is used as the rate limit key.
   - If the direct connection IP matches a trusted proxy, the `X-Forwarded-For` chain is traversed right-to-left across trusted proxies, stopping at the first untrusted upstream IP.
   - If all IPs in the chain belong to trusted proxies, rate limiting falls back to the connection IP.

2. **`TRUSTED_PROXY_HOPS`** (Default: `1`):
   Specifies the number of reverse proxy hops between the public Internet and the application.
   - Traefik/Coolify and Vercel each add 1 hop (the default).
   - Use `2` when running behind both a CDN (e.g., Cloudflare) and an internal reverse proxy.
   - Use `0` when the application is directly exposed without a reverse proxy; in this case, rate limiting ignores `X-Forwarded-For` and uses the connection IP directly.

3. **`CLIENT_IP_HEADER`**:
   For platforms that set an unforgeable client IP header (e.g., `cf-connecting-ip` on Cloudflare or `true-client-ip`), configure this variable to take precedence.

## Fallback Mechanism

If no valid client IP can be extracted from proxy headers or connection metadata, production instances log a warning and fall back to a SHA-256 fingerprint constructed from the client's `User-Agent` and `Accept-Language` headers, ensuring no single unknown IP bucket starves other users.
