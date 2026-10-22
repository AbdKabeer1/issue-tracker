import { parsePullRequestUrl } from "@/lib/github/merge-pr";

const PR_IN_TEXT = /https?:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/pull\/\d+/i;

/** The first GitHub pull request URL in free text, or null. */
export function firstPullRequestUrl(text: string | null | undefined): string | null {
  if (!text) return null;
  const match = text.match(PR_IN_TEXT);
  if (!match || !parsePullRequestUrl(match[0])) return null;
  return match[0];
}

/** A comment's structured `prUrl`, or the first pull request URL in its body. */
export function pullRequestUrlFromComment(body: string, metadata?: unknown): string | null {
  if (metadata && typeof metadata === "object" && "prUrl" in metadata) {
    const prUrl = (metadata as { prUrl?: unknown }).prUrl;
    if (typeof prUrl === "string" && parsePullRequestUrl(prUrl.trim())) return prUrl.trim();
  }
  return firstPullRequestUrl(body);
}

/** The first saved link that is a pull request, or null. */
export function firstPullRequestLink(links: readonly string[]): string | null {
  for (const link of links) {
    if (parsePullRequestUrl(link)) return link;
  }
  return null;
}

/**
 * When the assignee mentions a pull request and the issue has none yet,
 * the fields to write. Anyone else, or a second link, leaves the issue alone.
 */
export function pullRequestAttachment(input: {
  authorId: string;
  assigneeId: string | null;
  pullRequestUrl: string | null;
  proofLinks: readonly string[];
  body: string;
  metadata?: unknown;
}): { pullRequestUrl: string; proofLinks?: string[] } | null {
  if (input.authorId !== input.assigneeId || input.pullRequestUrl) return null;
  const pullRequestUrl = pullRequestUrlFromComment(input.body, input.metadata);
  if (!pullRequestUrl) return null;
  if (input.proofLinks.includes(pullRequestUrl)) return { pullRequestUrl };
  return { pullRequestUrl, proofLinks: [...input.proofLinks, pullRequestUrl] };
}
