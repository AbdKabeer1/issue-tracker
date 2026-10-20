import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createReviewOffers } from "@/lib/agent-api/review-offer";
import { agentIssueRequest, issueJson } from "@/lib/agent-api/issues";
import {
  mergeAcceptedFix,
  parseGitHubRepoUrl,
  parsePullRequestUrl,
  sameRepo,
} from "@/lib/github/merge-pr";

export const runtime = "nodejs";

const bodySchema = z
  .object({ pullRequestUrl: z.string().trim().min(1).max(2048) })
  .strict();

/**
 * POST /api/v1/issues/{id}/github — link the pull request that fixes this
 * issue (#452). A contributor or above may attach the URL, which is audited.
 *
 * When the fix has already been accepted (#434), the same call tries to merge
 * the pull request through the project's GitHub App installation; the merge is
 * gated on acceptance, an in-repo PR, green checks, and permission. Attaching
 * before acceptance links only — no merge is attempted.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return agentIssueRequest(request, "github.linked", "contributor", id, async (agent) => {
    const parsed = bodySchema.safeParse(await issueJson(request));
    if (!parsed.success) {
      return NextResponse.json({ error: "Send a pull request URL." }, { status: 400 });
    }

    const ref = parsePullRequestUrl(parsed.data.pullRequestUrl);
    if (!ref) {
      return NextResponse.json({ error: "That is not a GitHub pull request URL." }, { status: 400 });
    }

    const bug = await prisma.bug.findFirst({
      where: { id, tenantId: agent.tenantId, isDeleted: false },
      select: { id: true, project: { select: { repoUrl: true } } },
    });
    if (!bug) return NextResponse.json({ error: "No such issue." }, { status: 404 });

    const repo = parseGitHubRepoUrl(bug.project?.repoUrl);
    if (repo && !sameRepo(ref, repo)) {
      return NextResponse.json(
        { error: "That pull request is not in this project's repository." },
        { status: 422 },
      );
    }

    await prisma.bug.update({
      where: { id: bug.id },
      data: { pullRequestUrl: parsed.data.pullRequestUrl },
    });

    await createReviewOffers(prisma, agent, bug.id, {
      pullRequestUrl: parsed.data.pullRequestUrl,
    }).catch(() => null);

    const result = await mergeAcceptedFix(agent, id);
    if (result.status === 200) {
      return NextResponse.json({ linked: true, merged: true, mergeCommitSha: result.mergeCommitSha });
    }
    // The link is saved; the merge is simply not due yet.
    if (result.reason === "not_accepted") {
      return NextResponse.json({ linked: true, merged: false, reason: result.reason });
    }
    if (result.reason === "waiting_for_human") {
      return NextResponse.json(
        { error: "waiting_for_human", approvalId: result.approvalId, linked: true, merged: false },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { linked: true, merged: false, reason: result.reason, message: result.message },
      { status: result.status },
    );
  });
}
