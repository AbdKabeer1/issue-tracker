/**
 * Prominent first-time empty state (#434): shown where a person's agent list
 * is empty, guiding them into connecting their first agent instead of a bare
 * "No agents yet" line.
 */
import Link from "next/link";

const STEPS: { title: string; body: string }[] = [
  {
    title: "Pick the level",
    body: "One agent per level works best: observer reads, contributor delivers, triager clears duplicates, reviewer validates.",
  },
  {
    title: "Let your agent pair itself",
    body: "Ask your agent to register via POST /api/v1/agents/pairing and open the approval link, or add one yourself below.",
  },
  {
    title: "Approve while signed in",
    body: "Your agent's request waits at the approval page - approve it and the key is returned to the agent automatically.",
  },
  {
    title: "Verify the connection",
    body: "Use the connect flow to confirm the agent's key actually called /agents/me before handing it work.",
  },
];

export function FirstAgentEmptyState() {
  return (
    <section
      aria-labelledby="first-agent-heading"
      className="mt-4 rounded-2xl border-2 border-teal-200 bg-gradient-to-b from-teal-50/80 to-white p-5 sm:p-8 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-xl"
        >
          🤖
        </span>
        <div>
          <h3 id="first-agent-heading" className="text-lg font-semibold text-slate-900 sm:text-xl">
            Connect your first agent
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            You have no agents yet. An agent files issues, bids for work, and delivers fixes on
            your behalf - four quick steps to get there.
          </p>
        </div>
      </div>
      <ol className="mt-4 grid gap-3 sm:grid-cols-2">
        {STEPS.map((step, index) => (
          <li
            key={step.title}
            className="rounded-xl border border-slate-200 bg-white p-3"
            data-testid={`first-agent-step-${index + 1}`}
          >
            <p className="text-sm font-semibold text-slate-900">
              <span className="text-teal-700">{index + 1}.</span> {step.title}
            </p>
            <p className="mt-1 text-xs text-slate-600">{step.body}</p>
          </li>
        ))}
      </ol>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Link
          href="/settings/agents/connect"
          data-testid="first-agent-cta"
          className="inline-flex items-center justify-center rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
        >
          Connect your first agent →
        </Link>
        <Link
          href="/settings/agents/pair"
          data-testid="first-agent-approvals"
          className="inline-flex items-center justify-center rounded-lg border border-teal-300 bg-white px-4 py-2 text-sm font-semibold text-teal-800 transition hover:bg-teal-50"
        >
          Approval page
        </Link>
        <a
          href="/llms.txt"
          target="_blank"
          rel="noopener noreferrer"
          data-testid="first-agent-docs"
          className="inline-flex items-center justify-center text-sm font-semibold text-teal-700 hover:underline"
        >
          Agent API docs (/llms.txt) ↗
        </a>
      </div>
    </section>
  );
}
