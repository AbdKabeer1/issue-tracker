"use client";

import { useId, useState, type CSSProperties } from "react";
import { severityLabel } from "@/lib/labels";
import { avatarTone } from "@/lib/avatar";
import {
  IssueAgentActivity,
  timeOf,
  verdictVisual,
  VerdictGlyph,
  type AgentDecision,
} from "@/components/issue-agent-activity";

/** What each bot said, in a few words, for its card in the summary strip. */
function shortSaying(decision: AgentDecision): string {
  switch (decision.kind) {
    case "confirmed":
      return decision.severity
        ? `Confirmed it’s real · ${severityLabel[decision.severity]}`
        : "Confirmed it’s real";
    case "rejected":
      return "Not a real issue";
    case "claimed":
      return decision.waitingOnName
        ? `Waiting on ${decision.waitingOnName}`
        : `Working on it for ${decision.personName}`;
    case "verdict":
      return decision.goodToMerge ? "Fix is good to merge" : "Fix not ready to merge";
    case "accepted":
      return "Accepted the fix";
  }
}

function BotAvatar({ decision }: { decision: AgentDecision }) {
  const visual = verdictVisual(decision);
  return (
    <span className="relative shrink-0">
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-full ${avatarTone(decision.agentName)}`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[18px] w-[18px]" aria-hidden>
          <rect x="4" y="8" width="16" height="12" rx="3" />
          <path d="M12 8V4M9 14h.01M15 14h.01" strokeLinecap="round" />
          <circle cx="12" cy="3.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      </span>
      <span
        className={`absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-zk-surface [&_svg]:h-2.5 [&_svg]:w-2.5 ${visual.iconWrap}`}
      >
        <VerdictGlyph kind={decision.kind} goodToMerge={decision.kind === "verdict" ? decision.goodToMerge : undefined} />
      </span>
    </span>
  );
}

function BotCard({
  decision,
  onSelect,
  copy = false,
}: {
  decision: AgentDecision;
  onSelect: (id: string) => void;
  /** The marquee's second copy: hidden from assistive tech and the tab order. */
  copy?: boolean;
}) {
  return (
    <li className="shrink-0">
      <button
        type="button"
        tabIndex={copy ? -1 : undefined}
        onClick={() => onSelect(decision.id)}
        title={`Show what ${decision.agentName} said`}
        className="flex w-max items-center gap-2.5 rounded-xl border border-zk-border bg-zk-surface py-1.5 pl-1.5 pr-3.5 text-left hover:border-zk-accent hover:bg-zk-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-blue-strong"
      >
        <BotAvatar decision={decision} />
        <span className="flex flex-col leading-tight">
          <span className="text-[13px] font-semibold text-zk-text">{decision.agentName}</span>
          <span className="text-xs text-zk-text2">“{shortSaying(decision)}”</span>
        </span>
      </button>
    </li>
  );
}

/**
 * Agent decisions at a glance: a count on the left and, on the right, a card
 * per decision (the bot and what it said) drifting right to left. clicking a card
 * opens the full timeline at that decision.
 */
export function AgentDecisionsSummary({
  decisions,
  passed = false,
}: {
  decisions: ReadonlyArray<AgentDecision>;
  /** The bots' checks passed (enough confirmations, or the fix was accepted). */
  passed?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const panelId = useId();

  const showDecision = (id: string) => {
    setOpen(true);
    setHighlightId(id);
    // Wait a frame so the panel is laid out before scrolling to the entry.
    requestAnimationFrame(() => {
      document
        .getElementById(`agent-decision-${id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  };

  const ordered = [...decisions].sort((a, b) => timeOf(a) - timeOf(b) || a.id.localeCompare(b.id));
  // Too few cards to fill the strip: show them still rather than looping a gap.
  const animate = ordered.length >= 3;

  return (
    <section aria-label="Agent decisions" className="rounded-[20px] border border-zk-border bg-zk-surface p-3">
      <div className="flex items-stretch gap-3">
        <div
          className={`relative flex w-[76px] shrink-0 flex-col items-center justify-center rounded-xl px-2 py-2 text-center ${
            passed ? "bg-zk-ok-bg" : "bg-zk-chip"
          }`}
        >
          {passed ? (
            <span
              className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-zk-ok-fg text-zk-surface"
              title="Passed"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" className="h-2.5 w-2.5" aria-hidden>
                <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="sr-only">Passed</span>
            </span>
          ) : null}
          <span className="text-2xl font-bold leading-none text-zk-text tabular-nums">{ordered.length}</span>
          <h2 className="mt-1 text-[10px] font-bold uppercase leading-tight tracking-[0.08em] text-zk-muted">
            Agent decisions
          </h2>
        </div>
        {ordered.length === 0 ? (
          <p className="self-center text-sm text-zk-muted">No agent decisions yet.</p>
        ) : (
          <div
            className={`zk-marquee min-w-0 flex-1 self-center ${
              animate
                ? "overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_24px,black_calc(100%-24px),transparent)]"
                : "overflow-x-auto"
            }`}
          >
            <div
              className={animate ? "zk-marquee-track flex w-max" : "flex w-max"}
              style={animate ? ({ "--zk-marquee-duration": `${ordered.length * 6}s` } as CSSProperties) : undefined}
            >
              <ul className="flex shrink-0 gap-2 pr-2">
                {ordered.map((decision) => (
                  <BotCard key={decision.id} decision={decision} onSelect={showDecision} />
                ))}
              </ul>
              {animate ? (
                <ul aria-hidden="true" className="zk-marquee-copy flex shrink-0 gap-2 pr-2">
                  {ordered.map((decision) => (
                    <BotCard key={decision.id} decision={decision} onSelect={showDecision} copy />
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        )}
      </div>
      {ordered.length > 0 ? (
        <>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((value) => !value)}
            className="mt-2.5 flex w-full items-center justify-between gap-2 rounded-xl border border-zk-border bg-zk-chip/50 px-3 py-2 text-[13px] font-semibold text-zk-text2 hover:bg-zk-chip focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-blue-strong"
          >
            <span>{open ? "Hide decisions" : `Show all ${ordered.length} decisions`}</span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              className={`h-4 w-4 text-zk-muted motion-safe:transition-transform ${open ? "rotate-180" : ""}`}
              aria-hidden
            >
              <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {/* Grid rows animate from 0fr to 1fr, so the panel slides open to its natural height. */}
          <div
            id={panelId}
            className={`grid motion-safe:transition-[grid-template-rows] motion-safe:duration-200 ${
              open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            }`}
            inert={!open}
          >
            {/* overflow-clip, not overflow-hidden: it clips without being a scroll
                container, so scrolling to a decision mid-animation can't leave the
                top of the timeline scrolled out of reach. min-h-0 lets the 0fr row collapse. */}
            <div className="min-h-0 overflow-clip">
              <div className="px-1 pb-1 pt-3">
                <IssueAgentActivity decisions={decisions} bare highlightId={highlightId} />
              </div>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
