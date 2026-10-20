import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import type { AgentLevel, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { agentErrorResponse, assertKeyProject, requireAgent, type AgentContext } from "@/lib/agents/require-agent";
import { requireLevel } from "@/lib/agents/levels";
import { audit } from "@/lib/agents/audit";
import { consumeAgentBudget, agentBudgetExceededResponse } from "@/lib/agents/rate-budget";
import { createBugSchema, commentSchema, statusSchema, severitySchema } from "@/lib/validations/issue";
import { parsePlatformFilter, platformFilterWhere } from "@/lib/platform-filter";
import { createIssueWithPolicy, cursorOrderBy, cursorWhere, decodeCursor, pageSize, toPage } from "@/lib/agent-api/create-policy";
import { createdSummary, commentedSummary, commentPreview } from "@/lib/activity-log";
import { extractMentionedUserIds, normalizeMentions } from "@/lib/mentions";
import { commentDepth, MAX_COMMENT_DEPTH } from "@/lib/comments";
import { publish } from "@/lib/agent-api/events";
import { notifyLater } from "@/lib/notify";
import type { NotificationEvent } from "@/lib/notifications";

export class IssueApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const idSchema = z.string().trim().min(1).max(191);
const createSchema = createBugSchema.pick({ title: true, description: true, categoryId: true, proofLinks: true })
  .extend({
    projectId: idSchema.optional(), beneficiaryUserId: idSchema.optional(),
    typeId: z.unknown().optional(), severity: z.unknown().optional(), acknowledgeSimilar: z.unknown().optional(),
  }).strict();
const agentCommentSchema = commentSchema.extend({ projectId: idSchema.optional() }).strict();

/** Authenticate before parsing input, charge the shared budget, and audit outcomes including denials. */
export async function agentIssueRequest(
  request: NextRequest, action: string, level: AgentLevel, target: string | null,
  run: (agent: AgentContext) => Promise<Response>,
): Promise<Response> {
  let agent: AgentContext | undefined;
  let response: Response | undefined;
  try {
    agent = await requireAgent(request);
    requireLevel(agent, level);
    const budget = await consumeAgentBudget({ id: agent.agentId, burst: agent.burst }, level === "observer" ? "read" : "write");
    response = budget.allowed ? await run(agent) : agentBudgetExceededResponse(budget.retryAfterSeconds);
  } catch (error) {
    if (error instanceof IssueApiError) response = NextResponse.json({ error: error.message }, { status: error.status });
    else if (error instanceof z.ZodError) response = NextResponse.json({ error: "Invalid input.", details: error.issues }, { status: 422 });
    else response = agentErrorResponse(error);
  } finally {
    if (agent) {
      const payload = { status: response?.status ?? 500 };
      try {
        // Required domain audits commit inside the domain transaction. This
        // supplementary request log must not turn a committed write into a failure.
        await audit(agent, action, target, payload);
      } catch (error) {
        // Retain the failed record in server logs for investigation/recovery.
        console.error("[agent-api] request audit failed", {
          tenantId: agent.tenantId, agentId: agent.agentId, action, target, payload,
        }, error);
      }
    }
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function issueJson(request: NextRequest): Promise<unknown> {
  try { return await request.json(); }
  catch { throw new IssueApiError(400, "Send a valid JSON body."); }
}

/** Every call names a project; a project id alone never grants access to its tenant. */
export async function issueProject(agent: AgentContext, params: URLSearchParams, bodyProjectId?: string) {
  const queryId = params.get("projectId");
  if (queryId && bodyProjectId && queryId !== bodyProjectId) throw new IssueApiError(400, "Conflicting projectId values.");
  const projectId = idSchema.parse(queryId ?? bodyProjectId);
  const project = await prisma.project.findFirst({ where: { id: projectId, tenantId: agent.tenantId }, select: { id: true } });
  if (!project) throw new IssueApiError(404, "Project not found.");
  // A key issued for one project cannot read or change another (#742).
  assertKeyProject(agent, project.id);
  return { tenantId: agent.tenantId, projectId: project.id };
}

type Scope = { tenantId: string; projectId: string };
const issueSelect = {
  id: true, number: true, title: true, description: true, status: true, severity: true,
  categoryId: true, typeId: true, reporterId: true, assigneeId: true, beneficiaryUserId: true,
  createdByAgentId: true, projectId: true, createdAt: true, updatedAt: true, proofLinks: true,
} satisfies Prisma.BugSelect;

export async function listAgentIssues(scope: Scope, params: URLSearchParams) {
  const status = params.get("status");
  const severity = params.get("severity");
  const assignee = params.get("assignee");
  const platforms = await prisma.category.findMany({
    where: { tenantId: scope.tenantId },
    select: { id: true, name: true },
  });
  const cursorRaw = params.get("cursor");
  const cursor = decodeCursor(cursorRaw);
  if (cursorRaw !== null && !cursor) throw new IssueApiError(400, "Invalid cursor.");
  const limit = pageSize(params.get("limit"));
  const where: Prisma.BugWhereInput = {
    ...scope, isDeleted: false,
    ...(status ? { status: statusSchema.parse(status) } : {}),
    ...(severity ? { severity: severitySchema.parse(severity) } : {}),
    ...(assignee ? { assigneeId: assignee === "none" ? null : idSchema.parse(assignee) } : {}),
    ...platformFilterWhere(parsePlatformFilter(params.get("platform"), platforms)),
    ...cursorWhere(cursor),
  };
  const rows = await prisma.bug.findMany({ where, orderBy: cursorOrderBy(), take: limit + 1, select: issueSelect });
  return toPage(rows, limit);
}

export async function readAgentIssue(scope: Scope, id: string) {
  const issue = await prisma.bug.findFirst({
    where: { ...scope, id, isDeleted: false },
    select: { ...issueSelect, comments: {
      where: { deletedAt: null }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100,
      select: { id: true, body: true, authorId: true, agentId: true, parentId: true, createdAt: true, editedAt: true },
    } },
  });
  if (!issue) throw new IssueApiError(404, "Issue not found.");
  return issue;
}

async function normalizeTenantMentions(db: Prisma.TransactionClient, tenantId: string, body: string) {
  const ids = extractMentionedUserIds(body);
  const users = ids.length ? await db.user.findMany({
    where: { id: { in: ids }, memberships: { some: { tenantId } } }, select: { id: true, name: true },
  }) : [];
  return normalizeMentions(body, new Map(users.map((user) => [user.id, user.name])));
}

export async function createAgentIssue(agent: AgentContext, request: NextRequest) {
  const input = createSchema.parse(await issueJson(request));
  const scope = await issueProject(agent, request.nextUrl.searchParams, input.projectId);
  const beneficiaryUserId = input.beneficiaryUserId ?? agent.ownerId;
  const result = await createIssueWithPolicy({
    agent, projectId: scope.projectId, idempotencyKey: request.headers.get("Idempotency-Key"),
    title: input.title, typeId: input.typeId, severity: input.severity, acknowledgeSimilar: input.acknowledgeSimilar,
    insert: async (tx, policy) => {
      const member = await tx.membership.findUnique({
        where: { tenantId_userId: { tenantId: scope.tenantId, userId: beneficiaryUserId } }, select: { userId: true },
      });
      if (!member) throw new IssueApiError(422, "The beneficiary must be a member of the tenant.");
      const categoryId = input.categoryId || null;
      if (categoryId) {
        const category = await tx.category.findFirst({
          where: { id: categoryId, tenantId: scope.tenantId, isActive: true },
          select: { id: true },
        });
        if (!category) throw new IssueApiError(422, "Platform not found or inactive.");
      }
      const description = await normalizeTenantMentions(tx, scope.tenantId, input.description);
      const issue = await tx.bug.create({
        data: {
          ...scope, ...policy, title: input.title, description, status: "open", categoryId,
          reporterId: beneficiaryUserId, beneficiaryUserId, createdByAgentId: agent.agentId,
          proofLinks: input.proofLinks,
          watches: { create: { userId: beneficiaryUserId } },
          activities: { create: { actorId: beneficiaryUserId, type: "created", summary: createdSummary(input.title) } },
        }, select: { id: true },
      });
      await audit(agent, "issue.created", issue.id, { beneficiaryUserId }, { db: tx, bugId: issue.id });
      await publish(tx, {
        tenantId: scope.tenantId,
        type: "issue.created",
        payload: { issueId: issue.id, projectId: scope.projectId, beneficiaryUserId },
        actorAgentId: agent.agentId,
        bugId: issue.id,
      });
      return issue;
    },
  });
  if (result.status !== 200 && result.status !== 201) return NextResponse.json(result, { status: result.status });
  // A reused key can refer to another project; never return an out-of-scope issue.
  const issue = await readAgentIssue(scope, result.bugId);
  // #533: people mentioned in an agent's report hear about it, as they would
  // from a person's. A replayed create was already announced.
  if (!result.replayed) {
    const mentioned = extractMentionedUserIds(issue.description ?? "");
    if (mentioned.length > 0) {
      notifyLater({
        kind: "mentioned",
        place: "description",
        actorId: agent.ownerId,
        actorName: agent.name,
        bugId: issue.id,
        bugTitle: issue.title,
        recipientIds: mentioned,
      });
    }
  }
  return NextResponse.json({ issue, replayed: result.replayed }, { status: result.status });
}

export async function commentOnAgentIssue(agent: AgentContext, request: NextRequest, bugId: string) {
  const input = agentCommentSchema.parse(await issueJson(request));
  const scope = await issueProject(agent, request.nextUrl.searchParams, input.projectId);
  let bug: { id: string; title: string; reporterId: string; assigneeId: string | null } | null = null;
  let parentAuthorId: string | null = null;
  const comment = await prisma.$transaction(async (tx) => {
    bug = await tx.bug.findFirst({
      where: { ...scope, id: bugId, isDeleted: false },
      select: { id: true, title: true, reporterId: true, assigneeId: true },
    });
    if (!bug) throw new IssueApiError(404, "Issue not found.");
    if (input.parentId) {
      const parent = await tx.comment.findFirst({ where: { id: input.parentId, bugId, deletedAt: null }, select: { id: true, authorId: true } });
      if (!parent) throw new IssueApiError(422, "Parent comment not found on this issue.");
      parentAuthorId = parent.authorId;
      const thread = await tx.comment.findMany({ where: { bugId }, select: { id: true, parentId: true } });
      if (commentDepth(parent.id, new Map(thread.map((row) => [row.id, row.parentId]))) >= MAX_COMMENT_DEPTH) {
        throw new IssueApiError(422, "The reply nesting limit has been reached.");
      }
    }
    const body = await normalizeTenantMentions(tx, scope.tenantId, input.body);
    const created = await tx.comment.create({
      data: { bugId, authorId: agent.ownerId, agentId: agent.agentId, body, parentId: input.parentId ?? null },
      select: { id: true, bugId: true, authorId: true, agentId: true, body: true, parentId: true, createdAt: true },
    });
    await tx.bugActivity.create({ data: {
      bugId, actorId: agent.ownerId, type: "commented", summary: commentedSummary(body),
      metadata: { commentId: created.id, commentPreview: commentPreview(body) },
    } });
    await tx.bug.update({ where: { id: bugId }, data: { updatedAt: new Date() } });
    await tx.issueWatch.upsert({ where: { userId_bugId: { bugId, userId: agent.ownerId } },
      create: { bugId, userId: agent.ownerId }, update: {} });
    await audit(agent, "comment.created", created.id, { authorId: agent.ownerId }, { db: tx, bugId });
    await publish(tx, {
      tenantId: scope.tenantId,
      type: "comment.created",
      payload: { commentId: created.id, issueId: bugId, authorId: agent.ownerId },
      actorAgentId: agent.agentId,
      bugId,
    });
    return created;
  });
  notifyAgentComment(agent, bug, comment, parentAuthorId);
  return NextResponse.json({ comment }, { status: 201 });
}

/**
 * #533: an agent's comment notifies the same people a person's would:
 * anyone it @mentions, and the issue's watchers (reporter, assignee and
 * watch rows), with a "replied to your comment" for the parent's author.
 * The agent's owner is the actor, so they aren't told about their own agent.
 */
function notifyAgentComment(
  agent: AgentContext,
  bug: { id: string; title: string; reporterId: string; assigneeId: string | null } | null,
  comment: { id: string; body: string },
  parentAuthorId: string | null,
): void {
  if (!bug) return;
  const actor = { actorId: agent.ownerId, actorName: agent.name, bugId: bug.id, bugTitle: bug.title };
  const excerpt = commentPreview(comment.body);
  const mentioned = extractMentionedUserIds(comment.body);
  const events: NotificationEvent[] = [];
  if (mentioned.length > 0) {
    events.push({ ...actor, kind: "mentioned", place: "comment", recipientIds: mentioned, excerpt, commentId: comment.id });
  }
  events.push({
    ...actor,
    kind: "comment_added",
    commentId: comment.id,
    excerpt,
    parentAuthorId,
    recipientIds: [bug.reporterId, bug.assigneeId].filter((id): id is string => Boolean(id)),
    excludeIds: mentioned,
  });
  notifyLater(...events);
}
