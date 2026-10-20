import { createVerify, generateKeyPairSync } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

  it("refuses to merge an acceptance a tenant admin has undone (#490)", async () => {
    // A fake table holding only an undone acceptance row: the lookup must
    // filter on `undoneAt: null` or it comes back and the merge goes ahead.
    const rows = [{ id: "accepted-1", undoneAt: new Date("2026-10-19T10:00:00Z") }];
    db.agentAuditEvent.findFirst.mockImplementation(async (args: { where?: { undoneAt?: null } }) =>
      rows.find((row) => (args?.where?.undoneAt === null ? row.undoneAt === null : true)) ?? null,
    );
    const client = fakeClient();

    const result = await mergeAcceptedFix(agent, "bug1", { client });

    expect(result).toMatchObject({ status: 409, reason: "not_accepted" });
    expect(client.getPullRequest).not.toHaveBeenCalled();
    expect(client.mergePullRequest).not.toHaveBeenCalled();
  });

  it("still merges while the acceptance stands, never undone (#490)", async () => {
    const rows = [{ id: "accepted-1", undoneAt: null }];
    db.agentAuditEvent.findFirst.mockImplementation(async (args: { where?: { undoneAt?: null } }) =>
      rows.find((row) => (args?.where?.undoneAt === null ? row.undoneAt === null : true)) ?? null,
    );
    const client = fakeClient();

    const result = await mergeAcceptedFix(agent, "bug1", { client });

    expect(result).toMatchObject({ status: 200, merged: true });
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
