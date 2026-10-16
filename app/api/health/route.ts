import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cleanEnv } from "@/lib/env-clean";
import { calculateVoteChange } from "@/lib/voting";
import { createdSummary } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const googleClientId = cleanEnv(
    process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE_ID,
  );
  const googleClientSecret = cleanEnv(
    process.env.GOOGLE_CLIENT_SECRET || process.env.AUTH_GOOGLE_SECRET,
  );

  let dbOk = false;
  const schemaStatus: Record<string, boolean> = {};
  const schemaErrors: string[] = [];

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;

    // Verify key columns exist in Postgres
    const columns: Array<{ table_name: string; column_name: string }> =
      await prisma.$queryRaw`
        SELECT table_name, column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND (
            (table_name = 'User' AND column_name IN ('role', 'passwordHash', 'emailVerified')) OR
            (table_name = 'Vote' AND column_name IN ('value', 'userId', 'bugId')) OR
            (table_name = 'Bug' AND column_name IN ('proofLinks', 'voteCount', 'severity', 'status')) OR
            (table_name = 'BugActivity' AND column_name IN ('type', 'summary', 'metadata')) OR
            (table_name = 'Comment' AND column_name IN ('parentId', 'body'))
          )
      `;

    for (const c of columns) {
      schemaStatus[`${c.table_name}.${c.column_name}`] = true;
    }
  } catch (error) {
    dbOk = false;
    schemaErrors.push(error instanceof Error ? error.message : String(error));
  }

  const searchParams = request.nextUrl.searchParams;
  let crudVerification: Record<string, unknown> | null = null;

  if (dbOk && searchParams.get("test") === "crud") {
    const testId = `health-check-${Date.now()}`;
    const testEmail = `${testId}@test.internal`;
    try {
      // 1. Create test user
      const user = await prisma.user.create({
        data: {
          email: testEmail,
          name: "Health Check User",
          role: "user",
        },
      });

      // 2. Create test bug with activity
      const bug = await prisma.bug.create({
        data: {
          title: `Health Check Bug ${testId}`,
          description:
            "Testing bug creation and voting lifecycle in production DB",
          severity: "low",
          status: "open",
          proofLinks: ["https://example.com/health-proof"],
          reporterId: user.id,
          activities: {
            create: {
              actorId: user.id,
              type: "created",
              summary: createdSummary(`Health Check Bug ${testId}`),
            },
          },
        },
      });

      // 3. Upvote
      const { nextVote: upVoteVal, countDelta: upDelta } = calculateVoteChange(
        0,
        1,
      );
      await prisma.vote.create({
        data: { userId: user.id, bugId: bug.id, value: upVoteVal },
      });
      const bugUpvoted = await prisma.bug.update({
        where: { id: bug.id },
        data: { voteCount: { increment: upDelta } },
      });

      // 4. Downvote (flip vote from 1 to -1)
      const { nextVote: downVoteVal, countDelta: downDelta } =
        calculateVoteChange(1, -1);
      await prisma.vote.update({
        where: { userId_bugId: { userId: user.id, bugId: bug.id } },
        data: { value: downVoteVal },
      });
      const bugDownvoted = await prisma.bug.update({
        where: { id: bug.id },
        data: { voteCount: { increment: downDelta } },
      });

      // 5. Remove vote (from -1 back to 0)
      const { countDelta: unDelta } = calculateVoteChange(-1, -1);
      await prisma.vote.delete({
        where: { userId_bugId: { userId: user.id, bugId: bug.id } },
      });
      const bugUnvoted = await prisma.bug.update({
        where: { id: bug.id },
        data: { voteCount: { increment: unDelta } },
      });

      // 6. Threaded Comment
      const rootComment = await prisma.comment.create({
        data: {
          bugId: bug.id,
          authorId: user.id,
          body: "Root comment test",
        },
      });
      const replyComment = await prisma.comment.create({
        data: {
          bugId: bug.id,
          authorId: user.id,
          body: "Threaded reply test",
          parentId: rootComment.id,
        },
      });

      // 7. Cleanup
      await prisma.comment.deleteMany({ where: { bugId: bug.id } });
      await prisma.bugActivity.deleteMany({ where: { bugId: bug.id } });
      await prisma.bug.delete({ where: { id: bug.id } });
      await prisma.user.delete({ where: { id: user.id } });

      crudVerification = {
        success: true,
        userCreated: user.role === "user",
        bugCreated: bug.proofLinks.length === 1,
        upvoteSuccess: bugUpvoted.voteCount === 1,
        downvoteSuccess: bugDownvoted.voteCount === 1 - 2,
        unvoteSuccess: bugUnvoted.voteCount === 0,
        threadedCommentSuccess: replyComment.parentId === rootComment.id,
        cleanedUp: true,
      };
    } catch (crudErr) {
      crudVerification = {
        success: false,
        error: crudErr instanceof Error ? crudErr.message : String(crudErr),
      };
    }
  }

  const expectedColumns = [
    "User.role",
    "User.passwordHash",
    "User.emailVerified",
    "Vote.value",
    "Vote.userId",
    "Vote.bugId",
    "Bug.proofLinks",
    "Bug.voteCount",
    "BugActivity.type",
    "BugActivity.summary",
    "Comment.parentId",
  ];

  const allColumnsPresent = expectedColumns.every(
    (col) => schemaStatus[col] === true,
  );

  return NextResponse.json({
    status: dbOk && allColumnsPresent ? "healthy" : "degraded",
    uptime: process.uptime(),
    db: dbOk,
    schemaSynced: allColumnsPresent,
    schemaStatus,
    crudVerification,
    schemaErrors: schemaErrors.length > 0 ? schemaErrors : undefined,
    auth: {
      googleConfigured: Boolean(googleClientId) && Boolean(googleClientSecret),
      clientIdPrefix: googleClientId ? `${googleClientId.slice(0, 10)}…` : null,
      authSecretSet: Boolean(
        cleanEnv(process.env.AUTH_SECRET) ||
          cleanEnv(process.env.NEXTAUTH_SECRET),
      ),
    },
  });
}
