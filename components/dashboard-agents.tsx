"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BASE_PATH } from "@/lib/base-path";
import { RelativeTime } from "@/components/relative-time";

/**
 * The serialized row the server sends and the poll endpoint returns. Kept
 * local (not imported from the server-only data module) so this client
 * component has no edge into server code.
 */
export type DashboardAgentStatus = "waiting" | "working" | "idle" | "offline";

export type DashboardAgentView = {
  id: string;
  name: string;
  model: string | null;
  level: string;
  status: DashboardAgentStatus;
  activity: string;
  lastSeenAt: string | null;
};

export const AGENTS_POLL_MS = 30_000;

const statusMeta: Record<
  DashboardAgentStatus,
  { label: string; dot: string; text: string }
> = {
  waiting: { label: "Waiting on you", dot: "bg-sky-tint", text: "text-zk-info-fg" },
  working: { label: "Working", dot: "bg-zk-warn-fg", text: "text-zk-warn-fg" },
  idle: { label: "Idle", dot: "bg-zk-ok-fg", text: "text-zk-ok-fg" },
  offline: { label: "Offline", dot: "bg-zk-muted", text: "text-zk-muted" },
};

export function DashboardAgents({
  initial,
}: {
  initial: DashboardAgentView[];
}) {
  const [agents, setAgents] = useState(initial);
  const [open, setOpen] = useState(true);

  // Section-only refresh: the cards above are not re-fetched, so the page
  // never jumps while someone is reading it.
  useEffect(() => {
    const controller = new AbortController();
    let inFlight = false;
    const poll = async () => {
      if (inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      try {
        const response = await fetch(`${BASE_PATH}/api/dashboard/agents`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok || controller.signal.aborted) return;
        const data = (await response.json()) as { agents?: DashboardAgentView[] };
        if (!controller.signal.aborted && Array.isArray(data.agents)) setAgents(data.agents);
      } catch {
        // A failed or aborted poll keeps the last good rows; the next one retries.
      } finally {
        inFlight = false;
      }
    };
    const timer = window.setInterval(poll, AGENTS_POLL_MS);
    return () => {
      window.clearInterval(timer);
      controller.abort();
    };
  }, []);

  return (
    <section
      aria-labelledby="agents-heading"
      className="overflow-hidden rounded-[20px] border border-zk-border bg-zk-surface"
    >
      <div className="flex items-center justify-between border-b border-zk-divider px-5 py-4">
        <div className="flex items-center gap-2.5">
          <h2 id="agents-heading" className="text-base font-bold text-zk-text sm:text-lg">
            Your agents
          </h2>
          <span
            aria-label={`${agents.length} agent${agents.length === 1 ? "" : "s"}`}
            className="rounded-full border border-zk-border bg-zk-tint px-2 py-0.5 text-xs font-semibold text-zk-accent"
          >
            {agents.length}
          </span>
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="agents-body"
          aria-label="Toggle Your agents section"
          onClick={() => setOpen((value) => !value)}
          className="rounded-full p-2 text-zk-muted transition hover:bg-zk-tint hover:text-zk-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-blue focus-visible:ring-offset-2"
        >
          <svg
            className={`h-5 w-5 transition-transform motion-safe:duration-200 ${open ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {open ? (
        <div id="agents-body">
          {agents.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="font-medium text-zk-text">No agents yet</p>
              <p className="mt-1 text-sm text-zk-muted">
                Pair an agent to let it work on your issues and report back here.
              </p>
              <Link
                href="/settings/agents/pair"
                className="mt-4 inline-flex h-[42px] items-center justify-center rounded-full bg-electric-blue-strong px-4 text-sm font-semibold text-white transition hover:bg-[#255fe0]"
              >
                Pair your first agent
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-zk-divider bg-zk-tint/70 text-xs font-semibold uppercase tracking-wider text-zk-accent">
                    <th scope="col" className="px-5 py-3">Agent</th>
                    <th scope="col" className="px-5 py-3">Status</th>
                    <th scope="col" className="px-5 py-3">Current activity</th>
                    <th scope="col" className="px-5 py-3 text-right">Last seen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zk-divider">
                  {agents.map((agent) => {
                    const meta = statusMeta[agent.status];
                    return (
                      <tr key={agent.id} className="transition hover:bg-zk-tint/40">
                        <td className="px-5 py-3.5 font-semibold text-zk-text">
                          <span className="flex items-center gap-2">
                            <span
                              className={`h-2.5 w-2.5 shrink-0 rounded-full ${meta.dot}`}
                              aria-hidden="true"
                            />
                            <span className="truncate">{agent.name}</span>
                            {agent.model ? (
                              <span className="truncate text-xs font-normal text-zk-muted">
                                {agent.model}
                              </span>
                            ) : null}
                          </span>
                        </td>
                        <td className={`whitespace-nowrap px-5 py-3.5 font-medium ${meta.text}`}>
                          {meta.label}
                        </td>
                        <td className="max-w-[22rem] truncate px-5 py-3.5 text-zk-text2">
                          {agent.activity}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-right font-mono text-xs text-zk-muted">
                          {agent.lastSeenAt ? (
                            <RelativeTime date={agent.lastSeenAt} />
                          ) : (
                            "Never"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
