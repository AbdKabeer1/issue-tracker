import type { SignalStage } from "@/lib/signal-board";

const STAGES: { key: SignalStage; label: string }[] = [
  { key: "report", label: "Report" },
  { key: "confirm", label: "Confirm" },
  { key: "plan", label: "Plan" },
  { key: "build", label: "Build" },
  { key: "verify", label: "Verify" },
  { key: "ship", label: "Ship" },
];

export function SignalStageTrack({ stage }: { stage: SignalStage }) {
  const activeIndex = STAGES.findIndex((item) => item.key === stage);
  return (
    <ol className="signal-stage-track" aria-label="Issue stage">
      {STAGES.map((item, index) => (
        <li
          key={item.key}
          className="signal-stage-step"
          aria-current={index === activeIndex ? "step" : undefined}
          data-active={index === activeIndex ? "true" : undefined}
          data-passed={index < activeIndex ? "true" : undefined}
        >
          <span className="signal-stage-dot" aria-hidden="true" />
          <span className="signal-stage-label">{item.label}</span>
        </li>
      ))}
    </ol>
  );
}
