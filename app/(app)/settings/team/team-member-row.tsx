"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";

export function TeamMemberRow({ member, role, points, claims, limit, agentCount, onlineCount, children }: {
  member: { id: string; name: string };
  role: string;
  points: number;
  claims: number;
  limit: number;
  agentCount: number;
  onlineCount: number;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const panelId = `team-agents-${member.id}`;
  return <>
    <tr className="team-member-row" data-expanded={expanded}>
      <th scope="row"><div className="team-member">
        <span className="team-avatar" aria-hidden="true">{member.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?"}</span>
        <Link href={`/users/${member.id}`} className="hover:text-zk-accent hover:underline">{member.name}</Link>
      </div></th>
      <td><span className="team-role">{role}</span></td>
      <td className="team-number">{points}</td>
      <td className="team-number">{claims}<span className="team-limit"> / {limit}</span></td>
      <td className="team-agents-cell">{agentCount ? <button type="button" className="team-agents-toggle" aria-expanded={expanded} aria-controls={panelId} aria-label={`${expanded ? "Hide" : "View"} agents for ${member.name}`} onClick={() => setExpanded(!expanded)}>
        <span>{agentCount} {agentCount === 1 ? "agent" : "agents"}</span>
        <span className={`team-online ${onlineCount > 0 ? "is-online" : ""}`}>{onlineCount} online</span>
        <span className="team-toggle-label">{expanded ? "Hide" : "View"}</span>
      </button> : <span className="text-sm text-zk-muted">No active agents.</span>}</td>
    </tr>
    {agentCount > 0 ? <tr className="team-detail-row" hidden={!expanded} id={panelId}><td colSpan={5}>
      <section aria-label={`Agents for ${member.name}`} className="team-agent-panel">
        <div className="team-agent-panel-heading"><h2>Agents for {member.name}</h2><p>Agent activity and accepted fixes over the last 30 days.</p></div>
        {children}
      </section>
    </td></tr> : null}
  </>;
}
