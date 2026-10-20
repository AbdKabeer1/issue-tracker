import { createVerify, generateKeyPairSync } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  bug: { findFirst: vi.fn(), update: vi.fn() },
  agentAuditEvent: { findFirst: vi.fn(), create: vi.fn() },
  agentEvent: { create: vi.fn() },
  webhookSubscription: { findMany: vi.fn() },
  webhookDelivery: { createMany: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

const notify = vi.hoisted(() => ({ notifyMergeFailed: vi.fn() }));
vi.mock("@/lib/agent-notifications", () => ({ notifyMergeFailed: notify.notifyMergeFailed }));

import {
  createAppJwt,
  createInstallationClient,
  mergeAcceptedFix,
  parseGitHubRepoUrl,
  parsePullRequestUrl,
  sameRepo,
  type GitHubClient,
} from "./merge-pr";

const agent = {
  agentId: "m1",
  name: "merger-bot",
  ownerId: "owner",
  tenantId: "t1",
  level: "merger" as const,
  burst: false,
  keyId: "k",
};

function bugRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "bug1",
    title: "Fix the thing",
    tenantId: "t1",
    pullRequestUrl: "https://github.com/zedu/web/pull/7",
    assigneeId: "ada",
    project: { repoUrl: "https://github.com/zedu/web", githubInstallationId: "12345" },
    claims: [{ beneficiaryUserId: "ada" }],
    ...overrides,
  };
}

function fakeClient(overrides: Partial<GitHubClient> = {}): GitHubClient {
  return {
    getPullRequest: vi.fn(async () => ({ merged: false, mergeable: true, headSha: "head-sha" })),
    checksGreen: vi.fn(async () => true),
    mergePullRequest: vi.fn(async () => ({ merged: true, sha: "merge-sha" })),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(db));
  db.bug.findFirst.mockResolvedValue(bugRow());
  db.agentAuditEvent.findFirst.mockResolvedValue({ id: "accepted-1" });
  db.agentAuditEvent.create.mockResolvedValue({});
  db.agentEvent.create.mockResolvedValue({ id: "event-1" });
  db.webhookSubscription.findMany.mockResolvedValue([]);
});

describe("parseGitHubRepoUrl (#452)", () => {
  it("reads https and scp-style GitHub URLs, ignoring .git", () => {
    expect(parseGitHubRepoUrl("https://github.com/zedu/web.git")).toEqual({ owner: "zedu", repo: "web" });
    expect(parseGitHubRepoUrl("https://github.com/zedu/web")).toEqual({ owner: "zedu", repo: "web" });
    expect(parseGitHubRepoUrl("git@github.com:zedu/web.git")).toEqual({ owner: "zedu", repo: "web" });
  });

  it("rejects other hosts and empty input", () => {
    expect(parseGitHubRepoUrl("https://gitlab.com/zedu/web")).toBeNull();
    expect(parseGitHubRepoUrl("not a url")).toBeNull();
    expect(parseGitHubRepoUrl(null)).toBeNull();
  });
});

describe("parsePullRequestUrl (#452)", () => {
  it("reads a pull request URL", () => {
    expect(parsePullRequestUrl("https://github.com/zedu/web/pull/7")).toEqual({
      owner: "zedu",
      repo: "web",
      number: 7,
    });
  });

  it("rejects non-PR and non-GitHub URLs", () => {
    expect(parsePullRequestUrl("https://github.com/zedu/web")).toBeNull();
    expect(parsePullRequestUrl("https://gitlab.com/zedu/web/pull/7")).toBeNull();
  });
});

describe("sameRepo (#452)", () => {
  it("compares case-insensitively", () => {
    expect(sameRepo({ owner: "Zedu", repo: "Web" }, { owner: "zedu", repo: "web" })).toBe(true);
    expect(sameRepo({ owner: "zedu", repo: "web" }, { owner: "zedu", repo: "desktop" })).toBe(false);
  });
});

describe("createAppJwt (#452)", () => {
  it("signs a verifiable RS256 app JWT with the app id as issuer", () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const jwt = createAppJwt("123456", privateKey.export({ type: "pkcs1", format: "pem" }).toString(), 1_700_000_000_000);
    const [header, payload, signature] = jwt.split(".");
    expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual({ alg: "RS256", typ: "JWT" });
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
    expect(claims.iss).toBe("123456");
    expect(claims.exp - claims.iat).toBe(9 * 60);
    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${header}.${payload}`);
    verifier.end();
    expect(verifier.verify(publicKey, Buffer.from(signature, "base64url"))).toBe(true);
  });
});

describe("mergeAcceptedFix gates (#452)", () => {
  it("does not attempt a merge before the tracker accepts the fix", async () => {
    db.agentAuditEvent.findFirst.mockResolvedValue(null);
    const client = fakeClient();

    const result = await mergeAcceptedFix(agent, "bug1", { client });

    expect(result).toMatchObject({ status: 409, reason: "not_accepted" });
    expect(client.getPullRequest).not.toHaveBeenCalled();
    expect(notify.notifyMergeFailed).not.toHaveBeenCalled();
  });

  it("rejects a pull request outside the project's repository", async () => {
    db.bug.findFirst.mockResolvedValue(
      bugRow({ pullRequestUrl: "https://github.com/someone/fork/pull/7" }),
    );
    const client = fakeClient();

    const result = await mergeAcceptedFix(agent, "bug1", { client });

    expect(result).toMatchObject({ status: 422, reason: "repo_mismatch" });
    expect(client.mergePullRequest).not.toHaveBeenCalled();
  });

  it("does not merge when the checks are red, and tells the claim's person", async () => {
    const client = fakeClient({ checksGreen: vi.fn(async () => false) });

    const result = await mergeAcceptedFix(agent, "bug1", { client });

    expect(result).toMatchObject({ status: 409, reason: "checks_failed" });
    expect(client.mergePullRequest).not.toHaveBeenCalled();
    expect(db.agentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: "github.merge_failed" }) }),
    );
    expect(notify.notifyMergeFailed).toHaveBeenCalledWith(
      expect.objectContaining({ recipientId: "ada", bugId: "bug1" }),
    );
  });

  it("does not merge without permission to merge the repo", async () => {
    const client = fakeClient({ mergePullRequest: vi.fn(async () => ({ merged: false, forbidden: true })) });

    const result = await mergeAcceptedFix(agent, "bug1", { client });

    expect(result).toMatchObject({ status: 403, reason: "no_permission" });
    expect(db.agentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: "github.merge_failed" }) }),
    );
  });

  it("refuses to merge when no installation is configured", async () => {
    db.bug.findFirst.mockResolvedValue(
      bugRow({ project: { repoUrl: "https://github.com/zedu/web", githubInstallationId: null } }),
    );

    const result = await mergeAcceptedFix(agent, "bug1", {});

    expect(result).toMatchObject({ status: 403, reason: "no_permission" });
  });

  it("merges a green, in-repo pull request after acceptance and records the sha", async () => {
    const client = fakeClient();

    const result = await mergeAcceptedFix(agent, "bug1", { client });

    expect(result).toEqual({
      status: 200,
      merged: true,
      mergeCommitSha: "merge-sha",
      pullRequestUrl: "https://github.com/zedu/web/pull/7",
    });
    expect(client.getPullRequest).toHaveBeenCalledWith({ owner: "zedu", repo: "web", number: 7 });
    expect(db.agentAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "github.merged",
          payload: { mergeCommitSha: "merge-sha", pullRequestUrl: "https://github.com/zedu/web/pull/7" },
        }),
      }),
    );
  });

  it("persists no token: it never writes the pull request back or stores a credential", async () => {
    const client = fakeClient();

    await mergeAcceptedFix(agent, "bug1", { client });

    expect(db.bug.update).not.toHaveBeenCalled();
    const writes = [
      ...db.agentAuditEvent.create.mock.calls,
      ...db.agentEvent.create.mock.calls,
    ];
    expect(JSON.stringify(writes)).not.toMatch(/token|ghs_|bearer/i);
  });
});

describe("checksGreen against the GitHub API (#491)", () => {
  const ref = { owner: "zedu", repo: "web", number: 7 };
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: "test",
    GITHUB_APP_ID: "123456",
    GITHUB_APP_PRIVATE_KEY: privateKey.export({ type: "pkcs1", format: "pem" }).toString(),
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function jsonResponse(data: unknown, ok = true): Response {
    return {
      ok,
      status: ok ? 200 : 500,
      json: async () => data,
      headers: new Headers(),
    } as unknown as Response;
  }

  /** Route GitHub's endpoints to canned responses; anything else throws. */
  function stubFetch(handler: (url: string, init?: RequestInit) => Response): ReturnType<typeof vi.fn> {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
      handler(String(input), init),
    );
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  const tokenRoute = (url: string) =>
    url.endsWith("/access_tokens") ? jsonResponse({ token: "ghs_test" }) : null;

  function checkRun(conclusion = "success") {
    return { status: "completed", conclusion };
  }

  it("treats a pending combined status with running checks as not green", async () => {
    stubFetch((url) =>
      tokenRoute(url) ??
      (url.includes("/check-runs")
        ? jsonResponse({ check_runs: [], total_count: 0 })
        : url.endsWith("/status")
          ? jsonResponse({ state: "pending", statuses: [{ context: "ci/build" }] })
          : jsonResponse({}, false)),
    );

    await expect(createInstallationClient("123", env).checksGreen(ref, "sha1")).resolves.toBe(false);
  });

  it("holds when the repository has no check runs and no statuses at all", async () => {
    stubFetch((url) =>
      tokenRoute(url) ??
      (url.includes("/check-runs")
        ? jsonResponse({ check_runs: [], total_count: 0 })
        : url.endsWith("/status")
          ? jsonResponse({ state: "pending", statuses: [] })
          : jsonResponse({}, false)),
    );

    await expect(createInstallationClient("123", env).checksGreen(ref, "sha1")).resolves.toBe(true);
  });

  it("passes on a success combined status", async () => {
    stubFetch((url) =>
      tokenRoute(url) ??
      (url.includes("/check-runs")
        ? jsonResponse({ check_runs: [], total_count: 0 })
        : url.endsWith("/status")
          ? jsonResponse({ state: "success", statuses: [{ context: "ci/build" }] })
          : jsonResponse({}, false)),
    );

    await expect(createInstallationClient("123", env).checksGreen(ref, "sha1")).resolves.toBe(true);
  });

  it("fails on a failure combined status", async () => {
    stubFetch((url) =>
      tokenRoute(url) ??
      (url.includes("/check-runs")
        ? jsonResponse({ check_runs: [], total_count: 0 })
        : url.endsWith("/status")
          ? jsonResponse({ state: "failure", statuses: [{ context: "ci/build" }] })
          : jsonResponse({}, false)),
    );

    await expect(createInstallationClient("123", env).checksGreen(ref, "sha1")).resolves.toBe(false);
  });

  it("reads past the first 30 check runs: a failure on page two blocks the merge", async () => {
    const fetchMock = stubFetch((url) => {
      const token = tokenRoute(url);
      if (token) return token;
      if (url.includes("/check-runs")) {
        const page = Number(new URL(url).searchParams.get("page"));
        const runs = page === 1 ? Array.from({ length: 100 }, () => checkRun()) : [checkRun("failure")];
        return jsonResponse({ check_runs: runs, total_count: 101 });
      }
      return jsonResponse({}, false);
    });

    await expect(createInstallationClient("123", env).checksGreen(ref, "sha1")).resolves.toBe(false);

    const runUrls = fetchMock.mock.calls.map((call) => String(call[0])).filter((url) => url.includes("/check-runs"));
    expect(runUrls[0]).toContain("per_page=100");
    expect(runUrls).toHaveLength(2);
    expect(runUrls[1]).toContain("page=2");
  });

  it("is green when every run across all pages has completed successfully", async () => {
    stubFetch((url) => {
      const token = tokenRoute(url);
      if (token) return token;
      if (url.includes("/check-runs")) {
        const page = Number(new URL(url).searchParams.get("page"));
        const runs = page === 1 ? Array.from({ length: 100 }, () => checkRun()) : [checkRun()];
        return jsonResponse({ check_runs: runs, total_count: 101 });
      }
      return jsonResponse({}, false);
    });

    await expect(createInstallationClient("123", env).checksGreen(ref, "sha1")).resolves.toBe(true);
  });

  it("is not green while any run across pages is still in progress", async () => {
    stubFetch((url) => {
      const token = tokenRoute(url);
      if (token) return token;
      if (url.includes("/check-runs")) {
        const page = Number(new URL(url).searchParams.get("page"));
        const runs = page === 1 ? Array.from({ length: 100 }, () => checkRun()) : [{ status: "in_progress", conclusion: null }];
        return jsonResponse({ check_runs: runs, total_count: 101 });
      }
      return jsonResponse({}, false);
    });

    await expect(createInstallationClient("123", env).checksGreen(ref, "sha1")).resolves.toBe(false);
  });
});
