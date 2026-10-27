import Link from "next/link";
import type { SignalState, SignalWorkforce } from "@/lib/signal-board";

function lastSeenLabel(iso: string | null): string {
  if (!iso) return "no signal";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function stateLabel(worker: SignalWorkforce): string {
  if (worker.state === "offline") {
    return `offline · last seen ${lastSeenLabel(worker.lastSeenAt)}`;
  }
  if (worker.state === "waiting") return "waiting on you";
  if (worker.state === "working") return "working";
  return "idle";
}

const STATE_CLASS: Record<SignalState, string> = {
  working: "sb2-state-working",
  waiting: "sb2-state-waiting",
  idle: "sb2-state-idle",
  offline: "sb2-state-offline",
};

export function WorkforceTower({ workers }: { workers: SignalWorkforce[] }) {
  return (
    <section className="sb2-workforce" aria-label="Workforce">
      <header className="sb2-section-head">
        <span className="sb2-label">Workforce</span>
        <Link href="/workers" className="sb2-text-link">
          Roster
        </Link>
      </header>

      {workers.length === 0 ? (
        <div className="sb2-empty sb2-empty-dark">
          <b>No agents paired yet.</b>
          <p>Pair an agent to put work on the board.</p>
          <Link href="/settings/agents" className="sb2-text-link">
            Pair an agent
          </Link>
        </div>
      ) : (
        <ul className="sb2-worker-list">
          {workers.slice(0, 4).map((worker) => (
            <li key={worker.id} className={`sb2-worker ${STATE_CLASS[worker.state]}`}>
              <span className="sb2-lamp" aria-hidden="true" />
              <span className="sb2-worker-main">
                <b>{worker.name}</b>
                <span>{worker.currentWork ?? stateLabel(worker)}</span>
              </span>
              <span className="sb2-kind">{worker.kind}</span>
              {worker.state === "offline" ? (
                <Link href="/settings/agents" className="sb2-reconnect">
                  Reconnect
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {workers.length > 4 ? (
        <Link href="/workers" className="sb2-text-link sb2-roster-more">
          View full roster
        </Link>
      ) : null}
    </section>
  );
}
