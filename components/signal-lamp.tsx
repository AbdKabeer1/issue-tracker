import type { SignalState } from "@/lib/signal-board";

const COLOR: Record<SignalState, string> = {
  working: "#3f9d72",
  waiting: "#c4862b",
  idle: "#b4aa97",
  offline: "#b74b3c",
};

const LABEL: Record<SignalState, string> = {
  working: "working",
  waiting: "needs you",
  idle: "idle",
  offline: "offline",
};

export function SignalLamp({ state, label }: { state: SignalState; label?: string }) {
  const color = COLOR[state];
  const text = label ?? LABEL[state];
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span
        aria-hidden="true"
        className="inline-block h-2 w-2 shrink-0 rounded-full border border-black/30"
        style={{
          backgroundColor: color,
          boxShadow: state === "idle" ? "none" : `0 0 7px ${color}`,
        }}
      />
      <span className="truncate text-[11px] font-medium text-zk-muted">{text}</span>
    </span>
  );
}
