"use client";

import type { AgentLevel } from "@prisma/client";
import { useState, useTransition } from "react";
import { revokeAgentAction, setAgentLevelAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { AGENT_LEVEL_LABELS } from "@/lib/agents/levels";

/** Change an agent's level or revoke it, as its owner or a team admin (#427). */
export function AgentControls({
  agentId,
  agentName,
  level,
  levels,
}: {
  agentId: string;
  agentName: string;
  level: AgentLevel;
  /** The levels this person may set. */
  levels: AgentLevel[];
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [current, setCurrent] = useState(level);
  const [pending, startTransition] = useTransition();

  function changeLevel(next: AgentLevel) {
    const previous = current;
    setCurrent(next);
    startTransition(async () => {
      const result = await setAgentLevelAction(agentId, next);
      if (result.ok) {
        toast(`${agentName} is now ${AGENT_LEVEL_LABELS[next].toLowerCase()}.`, "success");
      } else {
        setCurrent(previous);
        toast(result.error, "error");
      }
    });
  }

  async function revoke() {
    const ok = await confirm({
      title: `Revoke ${agentName}?`,
      body: "Its keys stop working immediately. This can't be undone; register a new agent to replace it.",
      confirmLabel: "Revoke agent",
      tone: "danger",
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await revokeAgentAction(agentId);
      toast(result.ok ? `${agentName} was revoked.` : result.error, result.ok ? "success" : "error");
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor={`level-${agentId}`} className="sr-only">
        Level for {agentName}
      </label>
      <Select
        id={`level-${agentId}`}
        value={current}
        disabled={pending}
        onChange={(event) => changeLevel(event.target.value as AgentLevel)}
        className="w-auto"
      >
        {/* The current level stays listed even if this person can't set it. */}
        {[...new Set([current, ...levels])].map((option) => (
          <option key={option} value={option} disabled={!levels.includes(option)}>
            {AGENT_LEVEL_LABELS[option]}
          </option>
        ))}
      </Select>
      <Button type="button" variant="danger-secondary" onClick={revoke} disabled={pending}>
        Revoke
      </Button>
    </div>
  );
}
