import { chainStageFor, type SignalChannel } from "@/lib/signal-board";

const STEPS = [
  { key: "plan", label: "Plan" },
  { key: "build", label: "Build" },
  { key: "verify", label: "Verify" },
] as const;

export function SignalHandoffChain({
  channel,
}: {
  channel: Pick<SignalChannel, "stage" | "worker" | "state">;
}) {
  const active = chainStageFor(channel.stage);
  return (
    <div className="signal-handoff">
      <span className="signal-handoff-chain" aria-label={`Handoff stage: ${active}`}>
        {STEPS.map((step, index) => (
          <span
            key={step.key}
            className="signal-handoff-step"
            data-active={step.key === active ? "true" : undefined}
          >
            {step.label}
            {index < STEPS.length - 1 ? <i aria-hidden="true">→</i> : null}
          </span>
        ))}
      </span>
      <span className="signal-handoff-worker">
        {channel.worker ? (
          <>
            <b>{channel.worker.name}</b>
            <span>{channel.worker.kind}</span>
          </>
        ) : (
          <span>unassigned</span>
        )}
      </span>
    </div>
  );
}
