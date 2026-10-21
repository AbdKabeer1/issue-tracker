import { createHmac, timingSafeEqual } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { statusChangedSummary } from "@/lib/activity-log";
import { publish } from "@/lib/agent-api/events";
import { prisma } from "@/lib/prisma";

/** True when `signature` is GitHub's `X-Hub-Signature-256` for this exact body. */
export function verifyGithubSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature?.startsWith("sha256=")) return false;
  const expected = Buffer.from(`sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`);
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

/**
 * #474: a pull request linked to an issue was merged on GitHub, not through
 * Ziki's merge gate. Resolve the issue, close its claim and tell pollers.
 * Solver points are not awarded here: they follow the review gates (a merger's
 * accept) or a person resolving the issue in the app.
 */
export async function resolveIssuesForMergedPullRequest(
  pullRequestUrl: string,
  db: PrismaClient = prisma,
): Promise<string[]> {
  const bugs = await db.bug.findMany({
    where: { pullRequestUrl, isDeleted: false, status: { not: "resolved" } },
    select: { id: true, tenantId: true, projectId: true, status: true, assigneeId: true, reporterId: true,
      claims: { where: { status: "active", releasedAt: null }, select: { id: true, agentId: true, beneficiaryUserId: true } } },
  });
  for (const bug of bugs) {
    await db.$transaction(async (tx) => {
      await tx.bug.update({ where: { id: bug.id }, data: { status: "resolved" } });
      await tx.bugActivity.create({
        data: {
          bugId: bug.id,
          actorId: bug.assigneeId ?? bug.claims[0]?.beneficiaryUserId ?? bug.reporterId,
          type: "status_changed",
          summary: statusChangedSummary(bug.status, "resolved"),
          metadata: { field: "status", from: bug.status, to: "resolved", via: "github_pull_request_merged", pullRequestUrl },
        },
      });
      await tx.issueClaim.updateMany({
        where: { bugId: bug.id, status: "active", releasedAt: null },
        data: { status: "released", releasedAt: new Date(), releaseReason: "resolved" },
      });
      for (const claim of bug.claims) {
        await publish(tx, {
          tenantId: bug.tenantId, type: "claim.released", actorAgentId: claim.agentId, bugId: bug.id,
          payload: { claimId: claim.id, issueId: bug.id, beneficiaryUserId: claim.beneficiaryUserId, reason: "resolved" },
        });
      }
      await publish(tx, {
        tenantId: bug.tenantId, type: "issue.updated", bugId: bug.id,
        payload: { issueId: bug.id, projectId: bug.projectId, changed: ["status"], values: { status: "resolved" }, source: "github" },
      });
    });
  }
  return bugs.map((bug) => bug.id);
}
