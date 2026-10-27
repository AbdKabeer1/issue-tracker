import Link from "next/link";
import type { SignalState, SignalWorkforce } from "@/lib/signal-board";
import "./workforce-roster.css";

const COLOR: Record<SignalState, string> = {
  working: "#3f9d72",
  waiting: "#c4862b",
  idle: "#b4aa97",
  offline: "#b74b3c",
};

const LABEL: Record<SignalState, string> = {
  working: "working",
  waiting: "waiting on you",
  idle: "idle",
  offline: "offline",
};

function lastSeenLabel(iso: string | null): string {
  if (!iso) return "no signal";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function WorkforceRoster({ workers }: { workers: SignalWorkforce[] }) {
  return (
    <div className="workforce-roster">
      <header className="workforce-roster-head">
        <div>
          <p className="workforce-eyebrow">Workforce</p>
          <h1>Agents and bots on the line</h1>
          <p className="workforce-deck">
            Every worker in this workspace, what it is doing now, and whether its signal is live.
          </p>
        </div>
        <Link href="/dashboard" className="workforce-back">
          Back to the board
        </Link>
      </header>

      {workers.length === 0 ? (
        <div className="workforce-empty">
          <b>No agents paired yet.</b>
          <p>Pair an agent to put it on the line.</p>
          <Link href="/settings/agents">Pair an agent</Link>
        </div>
      ) : (
        <div className="workforce-grid">
          {workers.map((worker) => (
            <article key={worker.id} className={`workforce-card workforce-state-${worker.state}`}>
              <div className="workforce-state">
                <span
                  aria-hidden="true"
                  className="workforce-lamp"
                  style={{
                    backgroundColor: COLOR[worker.state],
                    boxShadow: worker.state === "idle" ? "none" : `0 0 7px ${COLOR[worker.state]}`,
                  }}
                />
                <span>{LABEL[worker.state]}</span>
                {worker.state === "offline" ? (
                  <span className="workforce-seen">{lastSeenLabel(worker.lastSeenAt)}</span>
                ) : null}
              </div>
              <h2>{worker.name}</h2>
              <p className="workforce-meta">
                {worker.kind} · {worker.level}
              </p>
              <p className="workforce-work">
                {worker.currentWork ?? (worker.state === "offline" ? "No active work" : "Waiting for work")}
              </p>
              {worker.state === "offline" ? (
                <Link
                  href="/settings/agents"
                  aria-label={`Reconnect ${worker.name}`}
                  className="workforce-reconnect"
                >
                  Reconnect
                </Link>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
