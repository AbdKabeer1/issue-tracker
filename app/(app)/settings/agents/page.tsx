import Link from "next/link";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { LocalTime } from "@/components/local-time";
import { RelativeTime } from "@/components/relative-time";
import { AGENT_LEVEL_DESCRIPTIONS, AGENT_LEVEL_LABELS, AGENT_LEVELS, settableLevels } from "@/lib/agents/levels";
import { isTenantAdminRole, tenantForOwner } from "@/lib/agents/membership";
import { CreateAgentForm } from "./create-agent-form";
import { AgentControls } from "./agent-controls";

export const metadata = { title: "Agents" };

const levelBadge = "bg-slate-100 text-slate-700";

/**
 * A person's agents and the team's (#427). Agents work issues for the person
 * who owns them; each has a level that says what it may do.
 */
import { isAgentPlatformEnabled } from "@/lib/feature-flags";

export default async function AgentsSettingsPage() {
  if (!isAgentPlatformEnabled()) {
    // Feature not enabled: show a safe message instead of the agents UI.
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900">Agents</h1>
          <p className="text-sm text-slate-600">The agent platform feature is not enabled in this environment.</p>
        </div>
      </div>
    );
  }

  const user = await requireUser();
  const tenant = await tenantForOwner(user.id);
  const isAdmin = isTenantAdminRole(tenant?.role, user.role);

  const [mine, members] = tenant
    ? await Promise.all([
        prisma.agent.findMany({
          where: { ownerUserId: user.id, tenantId: tenant.tenantId },
          orderBy: [{ revokedAt: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }],
          select: {
            id: true,
            name: true,
            model: true,
            level: true,
            createdAt: true,
            revokedAt: true,
            apiKeys: { where: { revokedAt: null }, select: { id: true, prefix: true, lastUsedAt: true } },
          },
        }),
        prisma.membership.findMany({
          where: { tenantId: tenant.tenantId },
          orderBy: { user: { name: "asc" } },
          select: {
            role: true,
            user: {
              select: {
                id: true,
                name: true,
                agents: {
                  where: { tenantId: tenant.tenantId, revokedAt: null },
                  orderBy: { createdAt: "asc" },
                  select: { id: true, name: true, model: true, level: true },
                },
              },
            },
          },
        }),
      ])
    : [[], []];

  const ownLevels = settableLevels({ isOwner: true, isTenantAdmin: isAdmin });
  const adminLevels = settableLevels({ isOwner: false, isTenantAdmin: true });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-1">
        <Link href="/settings" className="text-sm text-teal-700 hover:underline">
          ← Back to settings
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h1 className="text-2xl font-semibold text-slate-900">Agents</h1>
          <Link
            href="/settings/audit"
            className="inline-flex items-center gap-1 text-sm font-medium text-teal-700 hover:text-teal-900 hover:underline"
          >
            Agent audit log →
          </Link>
        </div>
        <p className="text-sm text-slate-600">
          Agents work issues for you. Each one acts as itself and in your name, and any points it
          earns go to you.
        </p>
      </div>

      {!tenant ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
          <p>
            You aren&apos;t in a workspace yet, so you can&apos;t register agents. Join a workspace via an invite from your team, or create your own workspace to start managing agents.
          </p>
          <div className="mt-3">
            <Link
              href="/tenants"
              className="inline-flex items-center justify-center rounded-lg bg-teal-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
            >
              Create or join a workspace →
            </Link>
          </div>
        </div>
      ) : (
        <>
          <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6" aria-labelledby="register-heading">
            <h2 id="register-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Register an agent
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Or let the agent ask to pair, then{" "}
              <Link href="/settings/agents/pair" className="text-teal-700 hover:underline">
                enter the code it shows you
              </Link>
              .
            </p>
            <CreateAgentForm />
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6" aria-labelledby="mine-heading">
            <h2 id="mine-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Your agents
            </h2>
            {mine.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">You haven&apos;t registered any agents yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {mine.map((agent) => (
                  <li key={agent.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="break-words font-medium text-slate-900">
                        {agent.name}
                        {agent.model ? <span className="font-normal text-slate-500"> · {agent.model}</span> : null}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {agent.revokedAt ? (
                          <>
                            Revoked <LocalTime date={agent.revokedAt} />
                          </>
                        ) : (
                          <>
                            {agent.apiKeys.length === 0 ? (
                              <span>No key · added <LocalTime date={agent.createdAt} /></span>
                            ) : (
                              agent.apiKeys.map((k) => (
                                <span key={k.id}>
                                  Key {k.prefix}…
                                  {k.lastUsedAt ? (
                                    <> · Last used <RelativeTime date={k.lastUsedAt} /></>
                                  ) : (
                                    <> · Never used</>
                                  )}
                                  {" "}· added <LocalTime date={agent.createdAt} />
                                </span>
                              ))
                            )}
                          </>
                        )}
                      </p>
                    </div>
                    {agent.revokedAt ? (
                      <Badge className="bg-red-50 text-red-700">Revoked</Badge>
                    ) : (
                      <AgentControls agentId={agent.id} agentName={agent.name} level={agent.level} levels={ownLevels} />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6" aria-labelledby="team-heading">
            <h2 id="team-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Team
            </h2>
            <p className="mt-2 text-sm text-slate-600">Everyone in your team and the agents working for them.</p>
            <ul className="mt-3 divide-y divide-slate-100">
              {members.map(({ role, user: member }) => (
                <li key={member.id} className="py-3">
                  <p className="text-sm font-medium text-slate-900">
                    <Link href={`/users/${member.id}`} className="hover:underline">
                      {member.name}
                    </Link>
                    {role !== "member" ? <Badge className={`ml-2 ${levelBadge}`}>{role === "owner" ? "Owner" : "Admin"}</Badge> : null}
                  </p>
                  {member.agents.length === 0 ? (
                    <p className="mt-1 text-xs text-slate-500">No agents</p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {member.agents.map((agent) => (
                        <li key={agent.id} className="flex flex-col gap-2 pl-4 sm:flex-row sm:items-center sm:justify-between">
                          <span className="text-sm text-slate-700">
                            {agent.name}
                            {agent.model ? <span className="text-slate-500"> · {agent.model}</span> : null}
                          </span>
                          {isAdmin && member.id !== user.id ? (
                            <AgentControls agentId={agent.id} agentName={agent.name} level={agent.level} levels={adminLevels} />
                          ) : (
                            <Badge className={levelBadge}>{AGENT_LEVEL_LABELS[agent.level]}</Badge>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6" aria-labelledby="levels-heading">
            <h2 id="levels-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Levels
            </h2>
            <dl className="mt-3 space-y-2 text-sm">
              {AGENT_LEVELS.map((level) => (
                <div key={level} className="sm:flex sm:gap-3">
                  <dt className="font-medium text-slate-900 sm:w-28">{AGENT_LEVEL_LABELS[level]}</dt>
                  <dd className="text-slate-600">{AGENT_LEVEL_DESCRIPTIONS[level]}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-slate-500">
              New agents start as observers. You can raise your own agents up to reviewer; only a team
              admin can make one a merger.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
