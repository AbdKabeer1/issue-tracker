import type { AgentStatus } from "@/lib/dashboard-overview";

// A body color per agent, picked from its name, so each one looks the same everywhere.
const BODY_COLORS = ["#3978F6", "#7C5CE0", "#0E9F8E", "#E07A2E", "#D04F7A", "#4A5BD4"];
const LIGHT: Record<AgentStatus, string> = {
  working: "#22C55E",
  waiting: "#F59E0B",
  idle: "#60A5FA",
  offline: "#94A3B8",
};

function colorFor(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return BODY_COLORS[hash % BODY_COLORS.length];
}

/**
 * A small robot standing for an agent: its own body color, and an antenna
 * light for its status (green working, amber waiting on you, blue standing
 * by, grey offline). A working agent's light pulses.
 */
export function AgentGraphic({ name, status, size = 40 }: { name: string; status: AgentStatus; size?: number }) {
  const body = colorFor(name);
  const light = LIGHT[status];
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className="shrink-0">
      <rect x="1" y="1" width="38" height="38" rx="12" fill={body} opacity="0.12" />
      {/* antenna */}
      <line x1="20" y1="7" x2="20" y2="12" stroke={body} strokeWidth="2" strokeLinecap="round" />
      <circle cx="20" cy="6" r="2.6" fill={light} className={status === "working" ? "motion-safe:animate-pulse" : undefined} />
      {/* head */}
      <rect x="9" y="12" width="22" height="17" rx="6" fill={body} />
      <rect x="12.5" y="16" width="15" height="8.5" rx="4.25" fill="white" opacity="0.92" />
      <circle cx="17" cy="20.25" r="1.9" fill={body} />
      <circle cx="23" cy="20.25" r="1.9" fill={body} />
      {/* ears */}
      <rect x="6.5" y="17" width="2.5" height="6" rx="1.25" fill={body} />
      <rect x="31" y="17" width="2.5" height="6" rx="1.25" fill={body} />
      {/* body */}
      <rect x="13" y="30" width="14" height="6" rx="3" fill={body} opacity="0.75" />
    </svg>
  );
}
