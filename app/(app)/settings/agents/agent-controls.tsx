"use client";

import type { AgentLevel } from "@prisma/client";
import { useState, useTransition } from "react";
import { regenerateAgentKeyAction, revokeAgentAction, setAgentAreaPreferencesAction, setAgentBurstAction, setAgentLevelAction } from "./actions";
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
  burst = false,
  canSetBurst = false,
  areas = [],
  areaPreferences = [],
}: {
  agentId: string;
  agentName: string;
  level: AgentLevel;
  /** The levels this person may set. */
  levels: AgentLevel[];
  projects: AgentProjectChoice[];
  /** The project the live key is limited to, when it has one. */
  currentProjectId?: string | null;
  /** Whether this agent uses the higher hourly write budget. */
  burst?: boolean;
  /** Admins may raise the budget. */
  canSetBurst?: boolean;
  areas?: { id: string; name: string; projectId: string }[];
  areaPreferences?: { projectId: string; projectAreaId: string }[];
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [current, setCurrent] = useState(level);
  const [burstOn, setBurstOn] = useState(burst);
  const [projectId, setProjectId] = useState(currentProjectId || projects[0]?.id || "");
  const [preferenceProjectId, setPreferenceProjectId] = useState(currentProjectId || projects[0]?.id || "");
  const [savedPreferences, setSavedPreferences] = useState<Record<string, string[]>>(() => {
    const grouped: Record<string, string[]> = {};
    for (const preference of areaPreferences) {
      (grouped[preference.projectId] ??= []).push(preference.projectAreaId);
    }
    return Object.fromEntries(Object.entries(grouped).map(([id, ids]) => [id, [...ids].sort()]));
  });
  const [draftPreferences, setDraftPreferences] = useState<Record<string, string[]>>(savedPreferences);
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

  function toggleBurst(next: boolean) {
    const previous = burstOn;
    setBurstOn(next);
    startTransition(async () => {
      const result = await setAgentBurstAction(agentId, next);
      if (result.ok) {
        toast(
          next
            ? `${agentName} can now make 400 writes an hour.`
            : `${agentName} is back to 30 writes an hour.`,
          "success",
        );
      } else {
        setBurstOn(previous);
        toast(result.error, "error");
      }
    });
  }

  const projectAreas = areas.filter((area) => area.projectId === preferenceProjectId);
  const selectedAreaIds = draftPreferences[preferenceProjectId] ?? [];
  const savedAreaIds = savedPreferences[preferenceProjectId] ?? [];
  const areaPreferencesChanged = selectedAreaIds.length !== savedAreaIds.length ||
    selectedAreaIds.some((id) => !savedAreaIds.includes(id));

  function toggleArea(areaId: string, checked: boolean) {
    setDraftPreferences((currentPreferences) => {
      const currentIds = currentPreferences[preferenceProjectId] ?? [];
      const nextIds = checked
        ? [...new Set([...currentIds, areaId])].sort()
        : currentIds.filter((id) => id !== areaId);
      return { ...currentPreferences, [preferenceProjectId]: nextIds };
    });
  }

  function saveAreaPreferences() {
    const nextIds = selectedAreaIds;
    startTransition(async () => {
      const result = await setAgentAreaPreferencesAction(agentId, preferenceProjectId, nextIds);
      if (result.ok) {
        setSavedPreferences((currentPreferences) => ({ ...currentPreferences, [preferenceProjectId]: [...nextIds] }));
        toast("Area preferences saved.", "success");
      } else {
        toast(result.error, "error");
      }
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
        {canSetBurst ? (
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={burstOn}
              disabled={pending}
              onChange={(event) => toggleBurst(event.target.checked)}
            />
            Higher write budget
          </label>
        ) : burstOn ? (
          <span className="text-xs text-slate-500">Higher write budget</span>
        ) : null}
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
      <details className="w-full text-left sm:max-w-md">
        <summary className="cursor-pointer text-xs font-medium text-teal-800 hover:underline">
          Preferred areas{selectedAreaIds.length ? ` (${selectedAreaIds.length})` : ""}
        </summary>
        <div className="mt-2 space-y-2 rounded-md border border-slate-200 p-3">
          <label className="block text-xs font-medium text-slate-700" htmlFor={`area-project-${agentId}`}>
            Project
          </label>
          <Select
            id={`area-project-${agentId}`}
            value={preferenceProjectId}
            disabled={pending || projects.length === 0}
            onChange={(event) => setPreferenceProjectId(event.target.value)}
          >
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </Select>
          {projectAreas.length ? (
            <fieldset className="space-y-1">
              <legend className="text-xs font-medium text-slate-700">Prefer this agent for</legend>
              {projectAreas.map((area) => (
                <label key={area.id} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={selectedAreaIds.includes(area.id)}
                    disabled={pending}
                    onChange={(event) => toggleArea(area.id, event.target.checked)}
                  />
                  {area.name}
                </label>
              ))}
            </fieldset>
          ) : (
            <p className="text-xs text-slate-500">This project has no areas yet.</p>
          )}
          <Button type="button" variant="secondary" disabled={pending || !areaPreferencesChanged} onClick={saveAreaPreferences}>
            {pending ? "Saving…" : "Save area preferences"}
          </Button>
        </div>
      </details>
    </div>
  );
}
