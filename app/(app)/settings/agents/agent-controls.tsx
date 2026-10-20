"use client";

import type { AgentLevel } from "@prisma/client";
import { useState, useTransition } from "react";
import { regenerateAgentKeyAction, revokeAgentAction, setAgentLevelAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { copyText } from "@/lib/clipboard";
import { AGENT_LEVEL_LABELS } from "@/lib/agents/levels";
import type { AgentProjectChoice } from "./create-agent-form";

/** Change an agent's level or revoke it, as its owner or a team admin (#427). */
export function AgentControls({
  agentId,
  agentName,
  level,
  levels,
  projects,
  currentProjectId,
}: {
  agentId: string;
  agentName: string;
  level: AgentLevel;
  /** The levels this person may set. */
  levels: AgentLevel[];
  projects: AgentProjectChoice[];
  /** The project the live key is limited to, when it has one. */
  currentProjectId?: string | null;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [current, setCurrent] = useState(level);
  const [projectId, setProjectId] = useState(currentProjectId || projects[0]?.id || "");
  const [issued, setIssued] = useState<{ rawKey: string; prefix: string } | null>(null);
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

  async function regenerate() {
    const projectName = projects.find((project) => project.id === projectId)?.name ?? "the chosen project";
    const ok = await confirm({
      title: `Regenerate the key for ${agentName}?`,
      body: `The current key stops working immediately. The new key is shown once and only works in ${projectName}.`,
      confirmLabel: "Regenerate key",
      tone: "danger",
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await regenerateAgentKeyAction(agentId, projectId);
      if (result.ok) {
        setIssued({ rawKey: result.rawKey, prefix: result.prefix });
        toast("New key issued. Copy it now.", "success");
      } else {
        toast(result.error, "error");
      }
    });
  }

  async function copyIssued() {
    if (!issued) return;
    toast((await copyText(issued.rawKey)) ? "Key copied." : "Couldn't copy. Select the key and copy it.");
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
    <div className="flex flex-col gap-2 sm:items-end">
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
        <label htmlFor={`project-${agentId}`} className="sr-only">
          Project for the new key
        </label>
        <Select
          id={`project-${agentId}`}
          value={projectId}
          disabled={pending || projects.length === 0}
          onChange={(event) => setProjectId(event.target.value)}
          className="w-auto"
        >
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </Select>
        <Button type="button" variant="secondary" onClick={regenerate} disabled={pending || !projectId}>
          Regenerate key
        </Button>
        <Button type="button" variant="danger-secondary" onClick={revoke} disabled={pending}>
          Revoke
        </Button>
      </div>
      {issued ? (
        <div className="w-full space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 sm:max-w-md" role="status">
          <p className="text-sm font-medium text-slate-900">
            New key for {agentName} ({issued.prefix}…). Copy it now. It won&apos;t be shown again.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              readOnly
              value={issued.rawKey}
              aria-label={`New key for ${agentName}`}
              className="font-mono text-xs"
              onFocus={(event) => event.currentTarget.select()}
            />
            <Button type="button" onClick={copyIssued}>
              Copy key
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
