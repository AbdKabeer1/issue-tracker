import { createMethodNotAllowed, createOptions } from "@/lib/agent-api/http-errors";
import { NextResponse, type NextRequest } from "next/server";
import { agentIssueRequest, issueJson, issueProject } from "@/lib/agent-api/issues";
import { createJob, listJobs } from "@/lib/jobs/create";
import { createJobSchema } from "@/lib/validations/job";
import { isTenantAdmin } from "@/lib/agents/membership";

export const runtime = "nodejs";

/** GET ?projectId= — the project's research jobs, newest first (#617). */
export async function GET(request: NextRequest) {
  return agentIssueRequest(request, "jobs.list", "observer", null, async (agent) => {
    const scope = await issueProject(agent, request.nextUrl.searchParams);
    return NextResponse.json({ jobs: await listJobs(scope.tenantId, scope.projectId) });
  });
}

/** POST JSON with brief, dedupeKey, maxSubmissions, pointsPerAccepted, optional submissionSchema. */
export async function POST(request: NextRequest) {
  return agentIssueRequest(request, "jobs.create", "contributor", null, async (agent) => {
    // #512: a job pays points out of the ledger, so minting one is an
    // organization admin's decision. The web form says the same
    // ("Only an organization admin can post a job."); the API used to let
    // any contributor's agent post a job worth up to 10,000 points per
    // accepted submission. The agent's owner must be an admin or owner of
    // this workspace.
    if (!(await isTenantAdmin({ id: agent.ownerId }, agent.tenantId))) {
      return NextResponse.json(
        { error: "Only an organization admin can post a job." },
        { status: 403 },
      );
    }
    const parsed = createJobSchema.safeParse(await issueJson(request));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid job request.", details: parsed.error.issues }, { status: 400 });
    }
    const scope = await issueProject(agent, request.nextUrl.searchParams, parsed.data.projectId);
    try {
      const job = await createJob(agent, { ...parsed.data, projectId: scope.projectId });
      return NextResponse.json({ job }, { status: 201 });
    } catch (error) {
      if (error instanceof Error && "status" in error) throw error;
      return NextResponse.json({ error: "Could not create this job; try again." }, { status: 503 });
    }
  });
}

const apiMethodNotAllowed = createMethodNotAllowed(["GET", "HEAD", "POST", "OPTIONS"]);
const apiOptions = createOptions(["GET", "HEAD", "POST", "OPTIONS"]);
export const PUT = apiMethodNotAllowed;
export const PATCH = apiMethodNotAllowed;
export const DELETE = apiMethodNotAllowed;
export const OPTIONS = apiOptions;
