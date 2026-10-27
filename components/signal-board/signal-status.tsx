import type { OperationsBrief, SignalChannel } from "@/lib/signal-board";

export function SignalStatus({
  brief,
  channels,
}: {
  brief: OperationsBrief;
  channels: SignalChannel[];
}) {
  const working = channels.filter((channel) => channel.state === "working").length;
  const down = channels.filter((channel) => channel.state === "offline").length;

  return (
    <footer className="sb2-status" aria-label="Board status">
      <span className="sb2-status-clear">
        <i aria-hidden="true" />
        Line clear
      </span>
      <span>{working} working</span>
      <span>{down} down</span>
      <span>{brief.automationPct}% automation</span>
      <span className="sb2-status-spacer" />
      <span>{brief.openIssues} open</span>
      <span>{brief.pendingDecisions} waiting on you</span>
    </footer>
  );
}
