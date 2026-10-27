import type {
  OperationsBrief as Brief,
  SignalChannel,
  SignalDecision,
  SignalView,
  SignalWorkforce,
} from "@/lib/signal-board";
import { ChannelList } from "./channel-list";
import { DecisionQueue } from "./decision-queue";
import { OperationsBrief } from "./operations-brief";
import { SignalStatus } from "./signal-status";
import { WorkforceTower } from "./workforce-tower";
import "./signal-board.css";

export function SignalBoard({
  brief,
  channels,
  decisions,
  workforce,
  canDecide,
  pulseId,
  view,
}: {
  brief: Brief;
  channels: SignalChannel[];
  decisions: SignalDecision[];
  workforce: SignalWorkforce[];
  canDecide: boolean;
  pulseId?: string | null;
  view: SignalView;
}) {
  return (
    <div className="sb2" data-signal-board="">
      <div className="sb2-shell">
        <aside className="sb2-tower" aria-label="Tower">
          <OperationsBrief brief={brief} />
          <WorkforceTower workers={workforce} />
        </aside>
        <div className="sb2-board">
          <ChannelList channels={channels} view={view} pulseId={pulseId} />
        </div>
        <aside className="sb2-queue-column">
          <DecisionQueue decisions={decisions} canDecide={canDecide} />
        </aside>
        <SignalStatus brief={brief} channels={channels} />
      </div>
    </div>
  );
}
