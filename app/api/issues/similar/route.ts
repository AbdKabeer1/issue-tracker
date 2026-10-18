import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveSessionUserId } from "@/lib/session-user";
import { consumeRateLimit, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
import {
  fallbackTerms,
  normalizeQuery,
  pickSimilar,
  shouldSearch,
  SIMILAR_LIMIT,
  SIMILAR_RATE_LIMIT,
  SIMILAR_STATUSES,
  type ScoredIssue,
  type SimilarIssue,
} from "@/lib/similar-issues";

/** Searched over, then cut to SIMILAR_LIMIT once scored. */
const CANDIDATES = 10;

let trigramUnavailable = false;

async function trigramMatches(query: string): Promise<ScoredIssue[]> {
  // `%` (similarity) and `<%` (the query as a word-run inside the title)
  // are both served by "Bug_title_trgm_idx". Deleted issues and finished
  // ones are left out: nobody is reporting a duplicate of those.
  return prisma.$queryRaw<ScoredIssue[]>`
    SELECT "id", "number", "title", "status", "voteCount",
           GREATEST(similarity("title", ${query}), word_similarity(${query}, "title")) AS "score"
    FROM "Bug"
    WHERE "isDeleted" = false
      AND "status"::text = ANY(${SIMILAR_STATUSES as string[]})
      AND ("title" % ${query} OR ${query} <% "title")
    ORDER BY "score" DESC
    LIMIT ${CANDIDATES}`;
}

/** Without pg_trgm (the extension needs privileges some hosts lack). */
async function plainMatches(query: string): Promise<SimilarIssue[]> {
  const terms = fallbackTerms(query);
  if (terms.length < 1) return [];
  return prisma.bug.findMany({
    where: {
      isDeleted: false,
      status: { in: [...SIMILAR_STATUSES] },
      AND: terms.map((t) => ({ title: { contains: t, mode: "insensitive" as const } })),
    },
    select: { id: true, number: true, title: true, status: true, voteCount: true },
    orderBy: [{ voteCount: "desc" }, { updatedAt: "desc" }],
    take: SIMILAR_LIMIT,
  });
}

/**
 * Open issues whose title looks like `?q=` (#284). Signed-in only, rate
 * limited, and never more than the list would show the same person.
 */
export async function GET(req: NextRequest) {
  const resolved = await resolveSessionUserId();
  if ("error" in resolved) {
    return NextResponse.json({ error: "Sign in to search issues." }, { status: 401 });
  }
  if (!(await consumeRateLimit(`similar:${resolved.userId}`, SIMILAR_RATE_LIMIT)).allowed) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 });
  }

  const query = normalizeQuery(req.nextUrl.searchParams.get("q"));
  if (!shouldSearch(query)) return NextResponse.json({ issues: [] });

  let issues: SimilarIssue[];
  if (!trigramUnavailable) {
    try {
      issues = pickSimilar(await trigramMatches(query));
    } catch (error) {
      trigramUnavailable = true;
      console.error("[similar] trigram search failed; using plain matching from now on", error);
      issues = await plainMatches(query);
    }
  } else {
    issues = await plainMatches(query);
  }

  return NextResponse.json(
    { issues },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
