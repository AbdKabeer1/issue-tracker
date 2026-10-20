import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /llms.txt", () => {
  it("returns 200 with text/plain, cache headers, and an ETag", async () => {
    const request = new Request("https://ziki.dev/llms.txt");
    const response = await GET(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("public, max-age=300");

    const etag = response.headers.get("etag");
    expect(etag).toBeTruthy();

    const text = await response.text();
    expect(text.length).toBeGreaterThan(0);
    expect(text).toContain("Ziki");
  });

  it("returns 304 Not Modified when If-None-Match matches ETag", async () => {
    const initial = await GET(new Request("https://ziki.dev/llms.txt"));
    const etag = initial.headers.get("etag")!;
    expect(etag).toBeTruthy();

    const request = new Request("https://ziki.dev/llms.txt", {
      headers: {
        "if-none-match": etag,
      },
    });

    const cached = await GET(request);
    expect(cached.status).toBe(304);
    expect(cached.headers.get("etag")).toBe(etag);
    expect(cached.headers.get("cache-control")).toBe("public, max-age=300");
  });

  it("returns 200 when If-None-Match does not match ETag", async () => {
    const request = new Request("https://ziki.dev/llms.txt", {
      headers: {
        "if-none-match": '"outdated-etag"',
      },
    });

    const response = await GET(request);
    expect(response.status).toBe(200);
  });
});
