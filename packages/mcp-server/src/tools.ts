import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { RequestSpec } from "./client.js";

/**
 * One tool per agent API route. The zod shape is the single source for both
 * the MCP input schema and the tool's description, so the assistant sees the
 * same fields, limits and enums the route enforces. tools.test.ts checks that
 * every route here exists in app/api/v1 and in docs/ziki-for-agents.md.
 */
export type ToolDef = {
  name: string;
  /** What the tool does and when to use it. */
  summary: string;
  /** Minimum agent level the route needs (see docs/ziki-for-agents.md). */
  level: "observer" | "contributor" | "reviewer";
  method: RequestSpec["method"];
  /** Route under /api/v1; `{x}` segments are filled from the input field `x`. */
  route: string;
  input: z.ZodRawShape;
  /** Input fields sent as query parameters. */
  query?: readonly string[];
  /** Input fields sent in the JSON body. */
  body?: readonly string[];
  /** HTTP headers filled from input fields: `{ "Header-Name": "inputField" }`. */
  headers?: Readonly<Record<string, string>>;
  /** Adds `projectId` (input, else the paired project) to the query. */
  projectScoped?: boolean;
};

const projectId = z
  .string()
  .trim()
  .min(1)
  .optional()
  .describe("Project id. Defaults to the project this key was paired with.");

const issueId = z.string().trim().min(1).max(191).describe("Issue id (the `id` field, not the #number).");

const idempotencyKey = z
  .string()
  .trim()
  .min(1)
  .max(191)
  .optional()
  .describe("Unique key for this action, sent as the Idempotency-Key header. Reuse the same key when retrying so it is not applied twice. Generated if omitted.");

const cursor = z.string().optional().describe("Opaque cursor from a previous response.");
const wait = z.number().int().min(0).max(25).optional().describe("Long-poll seconds (0-25); returns as soon as something new arrives.");

export const TOOLS: readonly ToolDef[] = [
  {
    name: "ziki_whoami",
    summary: "Confirm the key works and read this agent's identity, level and the projects it can see.",
    level: "observer",
    method: "GET",
    route: "/agents/me",
    input: {},
  },
  {
    name: "ziki_list_projects",
    summary: "List the projects in this agent's tenant, to find a projectId.",
    level: "observer",
    method: "GET",
    route: "/projects",
    input: {},
  },
  {
    name: "ziki_list_issues",
    summary:
      "List issues in a project, newest first. Page with `nextCursor`. Use `stage` for the intake queue: reported, confirmed, or ready.",
    level: "observer",
    method: "GET",
    route: "/issues",
    projectScoped: true,
    query: ["status", "severity", "assignee", "platform", "area", "stage", "limit", "cursor"],
    input: {
      projectId,
      status: z.enum(["open", "in_progress", "resolved", "closed"]).optional().describe("Only issues in this status."),
      severity: z.enum(["low", "medium", "high", "critical"]).optional().describe("Only issues of this severity."),
      assignee: z.string().optional().describe("An assignee's user id, or `none` for unassigned issues."),
      platform: z.string().optional().describe("A platform (category) id, or `none` for issues with no platform."),
      area: z.string().optional().describe("A project area id, or `none` for issues without an area."),
      stage: z
        .enum(["reported", "confirmed", "ready"])
        .optional()
        .describe(
          "Intake stage of an open issue. reported: not yet confirmed. confirmed: two independent accepts and fewer than three upvotes. ready: confirmed and at least three upvotes, so the work can be taken. Issues that are no longer open have no stage.",
        ),
      limit: z.number().int().min(1).max(100).optional().describe("Page size (default 25, maximum 100)."),
      cursor,
    },
  },
  {
    name: "ziki_get_issue",
    summary: "Read one issue, with its claim state and the latest 100 comments.",
    level: "observer",
    method: "GET",
    route: "/issues/{id}",
    projectScoped: true,
    input: { id: issueId, projectId },
  },
  {
    name: "ziki_create_issue",
    summary:
      "File a new issue on behalf of the owner. Severity is set later by independent reviewers, not by you. Check for a duplicate with ziki_list_issues first.",
    level: "contributor",
    method: "POST",
    route: "/issues",
    projectScoped: true,
    body: ["title", "description", "categoryId", "areaId", "proofLinks", "attachmentIds"],
    headers: { "Idempotency-Key": "idempotencyKey" },
    input: {
      idempotencyKey,
      projectId,
      title: z.string().trim().min(3).max(200).describe("Short title, 3-200 characters."),
      description: z
        .string()
        .trim()
        .min(10)
        .max(5000)
        .describe("Markdown description, 10-5000 characters: steps to reproduce, expected and actual result."),
      categoryId: z.string().optional().describe("Platform (category) id."),
      areaId: z.string().optional().describe("Project area id (for example front end or back end)."),
      proofLinks: z
        .string()
        .optional()
        .describe("GitHub issue or pull request URLs related to this issue, one per line."),
      attachmentIds: z.array(z.string()).max(5).optional().describe("Up to 5 attachment ids already uploaded to Ziki."),
    },
  },
  {
    name: "ziki_list_comments",
    summary: "Read an issue's comments from the start, for threads longer than the 100 shown by ziki_get_issue.",
    level: "observer",
    method: "GET",
    route: "/issues/{id}/comments",
    projectScoped: true,
    query: ["cursor"],
    input: { id: issueId, projectId, cursor },
  },
  {
    name: "ziki_comment",
    summary: "Comment on an issue as the owner's agent. Use `type` for structured updates such as a delivery.",
    level: "contributor",
    method: "POST",
    route: "/issues/{id}/comments",
    projectScoped: true,
    body: ["body", "parentId", "type", "metadata", "attachmentIds"],
    input: {
      id: issueId,
      projectId,
      body: z.string().trim().min(1).max(2000).describe("Comment text, 1-2000 characters."),
      parentId: z.string().optional().describe("Id of the comment this replies to."),
      type: z
        .enum(["comment", "bid", "review", "delivery", "request_to_merge"])
        .optional()
        .describe("Comment type (default `comment`)."),
      metadata: z
        .record(z.string(), z.unknown())
        .optional()
        .describe("Structured details, for example `prUrl`, `commit`, `eta` or `verdict`."),
      attachmentIds: z.array(z.string()).max(5).optional().describe("Up to 5 attachment ids already uploaded to Ziki."),
    },
  },
  {
    name: "ziki_read_inbox",
    summary:
      "Read items addressed to this agent: offers, replies, mentions, answers from the owner, approvals and released claims. Oldest first.",
    level: "observer",
    method: "GET",
    route: "/inbox",
    query: ["after", "wait", "unread"],
    input: {
      after: z.string().optional().describe("`cursor` from a previous inbox response."),
      wait,
      unread: z.boolean().optional().describe("Only unread items."),
    },
  },
  {
    name: "ziki_mark_inbox_read",
    summary: "Mark inbox items read, by id or everything up to one item.",
    level: "observer",
    method: "POST",
    route: "/inbox/read",
    body: ["ids", "upTo"],
    input: {
      ids: z.array(z.string()).min(1).max(500).optional().describe("Inbox item ids. Use this or `upTo`, not both."),
      upTo: z.string().optional().describe("Mark this item and everything before it read."),
    },
  },
  {
    name: "ziki_volunteer",
    summary:
      "Volunteer (bid) for a confirmed open issue. A bid does not assign it: the reporter or an admin awards one. Ask the owner first.",
    level: "contributor",
    method: "POST",
    route: "/issues/{id}/bid",
    projectScoped: true,
    body: ["note"],
    input: {
      id: issueId,
      projectId,
      note: z.string().max(280).optional().describe("Short reason, at most 280 characters."),
    },
  },
  {
    name: "ziki_withdraw_bid",
    summary: "Withdraw this agent's open bid on an issue.",
    level: "contributor",
    method: "DELETE",
    route: "/issues/{id}/bid",
    projectScoped: true,
    input: { id: issueId, projectId },
  },
  {
    name: "ziki_request_offer",
    summary:
      "Ask for an offer on a ready issue. The server picks the next eligible person; the offer lasts 60 seconds, so accept it straight away.",
    level: "contributor",
    method: "POST",
    route: "/issues/{id}/offer",
    projectScoped: true,
    input: { id: issueId, projectId },
  },
  {
    name: "ziki_accept_offer",
    summary:
      "Accept an offer (a `claim.offered` inbox item) to turn it into the active claim. Starts the delivery deadline. 410 means it expired.",
    level: "contributor",
    method: "POST",
    route: "/offers/{id}/accept",
    input: { id: z.string().trim().min(1).describe("The offer's claim id.") },
  },
  {
    name: "ziki_heartbeat",
    summary:
      "Keep an active claim alive. Send at least every few minutes while working; a claim silent for 15 minutes is released.",
    level: "contributor",
    method: "POST",
    route: "/issues/{id}/heartbeat",
    projectScoped: true,
    input: { id: issueId, projectId },
  },
  {
    name: "ziki_extend_deadline",
    summary: "Spend the claim's one extension to move the delivery deadline.",
    level: "contributor",
    method: "POST",
    route: "/issues/{id}/extend",
    projectScoped: true,
    body: ["reason"],
    input: {
      id: issueId,
      projectId,
      reason: z.string().trim().min(1).max(500).describe("Why more time is needed, at most 500 characters."),
    },
  },
  {
    name: "ziki_link_pull_request",
    summary: "Link the GitHub pull request that fixes an issue. If the fix is already accepted, Ziki also tries to merge it.",
    level: "contributor",
    method: "POST",
    route: "/issues/{id}/github",
    projectScoped: true,
    body: ["pullRequestUrl"],
    input: {
      id: issueId,
      projectId,
      pullRequestUrl: z.string().trim().min(1).max(2048).describe("https://github.com/<owner>/<repo>/pull/<number>"),
    },
  },
  {
    name: "ziki_validate_issue",
    summary:
      "Give an independent verdict on a bug or fix. Your owner must not be the reporter or creator's owner. Two accepts confirm an issue.",
    level: "reviewer",
    method: "POST",
    route: "/issues/{id}/validations",
    projectScoped: true,
    body: ["kind", "verdict", "severity", "duplicateOfId", "notes", "onBehalfOfUserId"],
    input: {
      id: issueId,
      projectId,
      kind: z
        .enum(["real", "format", "duplicate", "fix"])
        .describe("What you are judging: `real` (is it a genuine bug), `format` (is it well written), `duplicate`, or `fix`."),
      verdict: z.enum(["accept", "reject"]).describe("accept or reject."),
      severity: z
        .enum(["low", "medium", "high", "critical"])
        .optional()
        .describe("Required when accepting `real`, and only allowed then. Severity can only be raised by reviewers."),
      duplicateOfId: z.string().optional().describe("For a duplicate verdict: the canonical issue id."),
      notes: z.string().trim().max(2000).optional().describe("Optional notes, at most 2000 characters."),
      onBehalfOfUserId: z.string().optional().describe("Defaults to the agent's owner."),
    },
  },
  {
    name: "ziki_submit_test_result",
    summary:
      "Submit a test verdict for the issue's linked pull request. Reporting again replaces your earlier verdict until the fix is accepted.",
    level: "reviewer",
    method: "POST",
    route: "/issues/{id}/test-results",
    projectScoped: true,
    body: ["goodToMerge", "notes", "onBehalfOfUserId", "headSha"],
    input: {
      id: issueId,
      projectId,
      goodToMerge: z.boolean().describe("true if the fix is good to merge."),
      notes: z.string().trim().max(2000).optional().describe("What you tested and where, at most 2000 characters."),
      onBehalfOfUserId: z.string().optional().describe("Defaults to the agent's owner."),
      headSha: z
        .string()
        .trim()
        .regex(/^[0-9a-f]{7,64}$/i, "headSha must be a hexadecimal commit SHA.")
        .optional()
        .describe(
          "The commit you tested (7-64 hex characters). Defaults to the SHA recorded when the pull request was linked.",
        ),
    },
  },
  {
    name: "ziki_ask_owner",
    summary: "Ask the owner a question, optionally about an issue. Read the answer with ziki_get_question or the inbox.",
    level: "contributor",
    method: "POST",
    route: "/questions",
    body: ["body", "bugId", "type"],
    input: {
      body: z.string().trim().min(3).max(2000).describe("The question, 3-2000 characters."),
      bugId: z.string().optional().describe("The issue this is about."),
      type: z
        .enum(["question", "work_authorization", "blocker", "scope_change", "human_approval"])
        .optional()
        .describe("What kind of ask this is (default `question`)."),
    },
  },
  {
    name: "ziki_get_question",
    summary: "Read a question this agent asked and, once the owner has answered, the answer.",
    level: "observer",
    method: "GET",
    route: "/questions/{id}",
    input: { id: z.string().trim().min(1).describe("Question id.") },
  },
];

/** Description shown to the assistant: what it does, the route it wraps, and the level it needs. */
export function describeTool(tool: ToolDef): string {
  return `${tool.summary} (${tool.method} /api/v1${tool.route}; needs ${tool.level} level or above.)`;
}

/** Turn validated tool input into the HTTP request for its route. */
export function buildRequest(
  tool: ToolDef,
  rawInput: Record<string, unknown>,
  defaults: { projectId: string | null },
): RequestSpec {
  const input = z.object(tool.input).parse(rawInput);
  const values = input as Record<string, unknown>;

  const path = tool.route.replace(/\{(\w+)\}/g, (_, key: string) => encodeURIComponent(String(values[key])));

  const query: NonNullable<RequestSpec["query"]> = {};
  for (const key of tool.query ?? []) {
    const value = values[key];
    if (value !== undefined) query[key] = value as string | number | boolean;
  }
  if (tool.projectScoped) {
    const project = (values.projectId as string | undefined) ?? defaults.projectId;
    if (project) query.projectId = project;
  }

  // The API rejects a POST without a JSON body, even when there is nothing to send.
  let body: Record<string, unknown> | undefined = tool.method === "POST" ? {} : undefined;
  if (tool.body) {
    body = {};
    for (const key of tool.body) {
      if (values[key] !== undefined) body[key] = values[key];
    }
  }

  let headers: Record<string, string> | undefined;
  for (const [header, key] of Object.entries(tool.headers ?? {})) {
    headers ??= {};
    headers[header] = (values[key] as string | undefined) ?? randomUUID();
  }

  return { method: tool.method, path, query, body, headers };
}
