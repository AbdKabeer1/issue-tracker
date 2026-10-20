import Link from "next/link";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { activeProjectIdFor } from "@/lib/project-context";
import { currentTenantIdFor, NO_TENANT_MESSAGE } from "@/lib/tenant-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyProjectIdButton } from "./copy-project-id";
import { CreateProjectForm } from "./create-project-form";
import { switchProjectAction } from "./actions";
import { isTenantAdminRole } from "@/lib/agents/membership";
import { MissionCoverage } from "./mission-coverage";

/* Distinct browser-tab title; the root layout appends "· Ziki Issues". */
export const metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const user = await requireUser();
  const tenantId = await currentTenantIdFor(user.id);

  if (!tenantId) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-2xl font-semibold text-slate-900">Projects</h1>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p>{NO_TENANT_MESSAGE}</p>
          <div className="mt-3">
            <Link
              href="/tenants"
              className="inline-flex items-center justify-center rounded-lg bg-teal-700 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-teal-800"
            >
              Create or join a workspace &rarr;
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const [tenant, projects, activeProjectId, membership] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    }),
    prisma.project.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        _count: { select: { bugs: true } },
        testMissions: {
          select: {
            id: true,
            routePattern: true,
            brief: true,
            role: true,
            viewport: true,
            lastCoveredAt: true,
            issuesFiled: true,
          },
          orderBy: [{ routePattern: "asc" }, { role: "asc" }, { viewport: "asc" }],
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    activeProjectIdFor(prisma, tenantId),
    prisma.membership.findUnique({
      where: { tenantId_userId: { tenantId, userId: user.id } },
      select: { role: true },
    }),
  ]);
  const canManageMissions = isTenantAdminRole(membership?.role, user.role);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <Link href="/issues" className="text-sm text-teal-700 hover:underline">
          ← Back to issues
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">Projects</h1>
        <p className="text-sm text-slate-600">
          Projects are the products inside {tenant?.name ?? "your workspace"}.
          New issues and the issue list use the active project.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
        <h2 className="text-base font-semibold text-slate-900">
          Create a project
        </h2>
        <CreateProjectForm />
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-6">
          <h2 className="text-base font-semibold text-slate-900">
            Your projects
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Switching here also changes the project shown in the header.
          </p>
        </div>
        {projects.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-600 sm:px-6">
            No projects yet. Create the first one above.
          </p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {projects.map((project) => {
              const active = project.id === activeProjectId;
              return (
                <li
                  key={project.id}
                  className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
                      <span className="truncate">{project.name}</span>
                      {active ? (
                        <Badge className="bg-teal-50 text-teal-800 ring-1 ring-teal-200">
                          Active
                        </Badge>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {project.slug} · {project._count.bugs}{" "}
                      {project._count.bugs === 1 ? "issue" : "issues"}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-xs text-slate-500">Project ID:</span>
                      <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700">
                        {project.id}
                      </code>
                      <CopyProjectIdButton projectId={project.id} />
                    </div>
                    <MissionCoverage
                      projectId={project.id}
                      canManage={canManageMissions}
                      missions={project.testMissions.map((mission) => ({
                        ...mission,
                        lastCoveredAt: mission.lastCoveredAt?.toISOString() ?? null,
                      }))}
                    />
                  </div>
                  {active ? null : (
                    <form action={switchProjectAction}>
                      <input type="hidden" name="projectId" value={project.id} />
                      <Button type="submit" variant="secondary">
                        Switch to {project.name}
                      </Button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
