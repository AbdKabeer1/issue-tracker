import type { OperationsBrief as Brief } from "@/lib/signal-board";

export function OperationsBrief({ brief }: { brief: Brief }) {
  return (
    <section className="sb2-brief" aria-label="Operations brief">
      <header className="sb2-section-head">
        <span className="sb2-label">Operations brief</span>
        <span className="sb2-muted">This week</span>
      </header>

      <div className="sb2-brief-grid">
        <div>
          <b>{brief.openIssues}</b>
          <span>open issues</span>
        </div>
        <div>
          <b>{brief.autoResolved}</b>
          <span>auto-resolved</span>
        </div>
        <div>
          <b>{brief.pendingDecisions}</b>
          <span>decisions</span>
        </div>
      </div>

      <div
        className="sb2-meter"
        role="img"
        aria-label={`${brief.automationPct}% automation coverage`}
      >
        <span style={{ width: `${Math.min(100, Math.max(0, brief.automationPct))}%` }} />
      </div>

      <footer className="sb2-brief-foot">
        <span>{brief.automationPct}% automation</span>
        <span>{brief.highPriority} high priority</span>
      </footer>
    </section>
  );
}
