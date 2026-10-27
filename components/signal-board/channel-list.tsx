import Link from "next/link";
import type { SignalChannel, SignalState, SignalView } from "@/lib/signal-board";

const TABS: { view: SignalView; label: string }[] = [
  { view: "all", label: "All" },
  { view: "mine", label: "Mine" },
  { view: "needs", label: "Needs you" },
  { view: "running", label: "Running" },
  { view: "down", label: "Down" },
];

const STATE_CLASS: Record<SignalState, string> = {
  working: "sb2-state-working",
  waiting: "sb2-state-waiting",
  idle: "sb2-state-idle",
  offline: "sb2-state-offline",
};

const STATE_TEXT: Record<SignalState, string> = {
  working: "working",
  waiting: "needs you",
  idle: "idle",
  offline: "down",
};

function Chain({ stage }: { stage: SignalChannel["chainStage"] }) {
  const steps: { key: SignalChannel["chainStage"]; label: string }[] = [
    { key: "plan", label: "Plan" },
    { key: "build", label: "Build" },
    { key: "verify", label: "Verify" },
  ];
  return (
    <span className="sb2-chain" aria-label={`Handoff stage: ${stage}`}>
      {steps.map((step, index) => (
        <span key={step.key} className="sb2-chain-step" data-active={step.key === stage ? "true" : undefined}>
          {step.label}
          {index < steps.length - 1 ? <i aria-hidden="true">→</i> : null}
        </span>
      ))}
    </span>
  );
}

export function ChannelList({
  channels,
  view,
  pulseId,
}: {
  channels: SignalChannel[];
  view: SignalView;
  pulseId?: string | null;
}) {
  return (
    <section className="sb2-channels" aria-label="All issues">
      <header className="sb2-board-head">
        <div className="sb2-board-title">
          <h1>All issues</h1>
          <span className="sb2-board-count">
            {channels.length} {channels.length === 1 ? "line" : "lines"}
          </span>
        </div>
        <nav className="sb2-tabs" aria-label="Issue views">
          {TABS.map((tab) => (
            <Link
              key={tab.view}
              href={`/dashboard?view=${tab.view}`}
              aria-current={view === tab.view ? "page" : undefined}
              className="sb2-tab"
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </header>

      {channels.length === 0 ? (
        <div className="sb2-empty">
          <b>No issues on this view.</b>
          <p>Clear the filter or file the first signal.</p>
          <Link href="/issues/new" className="sb2-text-link">
            File a signal
          </Link>
        </div>
      ) : (
        <ul className="sb2-channel-list">
          {channels.map((channel) => (
            <li
              key={channel.id}
              className={`sb2-channel ${STATE_CLASS[channel.state]}`}
              data-pulse={pulseId === channel.id ? "true" : undefined}
            >
              <span className="sb2-lamp" aria-hidden="true" />
              <Link href={`/issues/${channel.number}`} className="sb2-channel-main">
                <span className="sb2-channel-title">
                  <span className="sb2-channel-num">#{channel.number}</span>
                  {channel.title}
                </span>
                <span className="sb2-channel-meta">
                  {channel.activity ?? "No signal yet"} · {channel.voteCount}{" "}
                  {channel.voteCount === 1 ? "vote" : "votes"} · {channel.commentCount}{" "}
                  {channel.commentCount === 1 ? "comment" : "comments"}
                </span>
              </Link>
              <Chain stage={channel.chainStage} />
              <span className="sb2-worker-tag">
                {channel.worker ? (
                  <>
                    <b>{channel.worker.name}</b>
                    <span>{channel.worker.kind}</span>
                  </>
                ) : (
                  <span>unassigned</span>
                )}
              </span>
              <span className="sb2-state-text">{STATE_TEXT[channel.state]}</span>
            </li>
          ))}
        </ul>
      )}

      <footer className="sb2-board-foot">
        <span>
          {channels.length} {channels.length === 1 ? "issue" : "issues"} shown
        </span>
        <Link href="/issues?status=all&project=all" className="sb2-text-link">
          View full manifest
        </Link>
      </footer>
    </section>
  );
}
