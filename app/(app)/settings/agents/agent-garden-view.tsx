"use client";

import { useState } from "react";
import Link from "next/link";
import { AGENT_LEVEL_LABELS } from "@/lib/agents/levels";
import { useToast } from "@/components/ui/toast";
import { copyText } from "@/lib/clipboard";
import { agentBootstrapMessage } from "@/lib/agents/bootstrap-message";
import { AgentPlanReview } from "@/components/agent-plan-review";
import type { ManageAgentItem } from "./manage-agents-list";
import { levelBadgeClass } from "./agents-ui";

export type AgentGardenState = "working" | "idle" | "waiting" | "completed" | "error" | "offline";

export function AgentGardenView({
  agents,
  onOpenControls,
}: {
  agents: ManageAgentItem[];
  onOpenControls?: (agentId: string) => void;
}) {
  const [selectedReviewAgent, setSelectedReviewAgent] = useState<ManageAgentItem | null>(null);

  return (
    <div className="space-y-4">
      {/* Garden Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-zk-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg" aria-hidden="true">🌱</span>
            <h2 className="text-lg font-bold text-zk-text">Your Agent Garden</h2>
            <span className="rounded-full bg-zk-ok-bg px-2.5 py-0.5 text-xs font-bold text-zk-ok-fg">
              {agents.filter((a) => !a.revokedAt).length} active
            </span>
          </div>
          <p className="text-xs text-zk-muted mt-0.5">Your AI team, hard at work.</p>
        </div>
      </div>

      {/* Grid of Agent Garden Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map((agent) => {
          const state: AgentGardenState = agent.gardenState ?? (agent.revokedAt ? "offline" : "idle");
          const primaryKey = agent.apiKeys.find((k) => k.apiKey) ?? agent.apiKeys[0];

          return (
            <article
              key={agent.id}
              className={`rounded-[20px] border p-4 sm:p-5 flex flex-col justify-between transition-all duration-200 ${
                state === "waiting"
                  ? "border-amber-300 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/20 shadow-xs"
                  : state === "working"
                  ? "border-sky-300 dark:border-sky-800 bg-sky-50/20 dark:bg-sky-950/20 shadow-xs"
                  : state === "error"
                  ? "border-rose-300 dark:border-rose-800 bg-rose-50/20 dark:bg-rose-950/20"
                  : "border-zk-border bg-zk-surface shadow-2xs hover:border-zk-accent/40"
              }`}
            >
              <div>
                {/* Character Illustration & Status Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="relative shrink-0">
                    <GardenCharacter state={state} name={agent.name} />
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <GardenStateBadge state={state} />
                    <span className={levelBadgeClass(agent.level)}>
                      {AGENT_LEVEL_LABELS[agent.level]}
                    </span>
                  </div>
                </div>

                {/* Identity & Model */}
                <div className="space-y-0.5">
                  <h3 className="font-extrabold text-base text-zk-text break-words">
                    {agent.name}
                    {agent.personal ? <span className="font-normal text-xs text-zk-muted"> · personal</span> : null}
                  </h3>
                  <p className="text-xs text-zk-muted font-mono">{agent.model ?? "Standard Runner"}</p>
                </div>

                {/* Task / Activity Block */}
                <div className="mt-3 p-3 rounded-xl bg-zk-surface border border-zk-border/70 text-xs text-zk-text2">
                  {agent.activeTask ? (
                    <div>
                      <div className="flex items-center gap-1.5 font-semibold text-zk-text">
                        <span className="font-mono text-zk-accent">#{agent.activeTask.issueNumber}</span>
                        <span className="truncate">{agent.activeTask.issueTitle}</span>
                      </div>
                      <p className="text-[11px] text-zk-muted mt-0.5">
                        {state === "waiting" ? "Review required before dispatch" : "Execution lock active"}
                      </p>
                    </div>
                  ) : (
                    <p className="text-zk-muted flex items-center gap-1.5">
                      <span>{agent.gardenActivity ?? "Standing by in garden"}</span>
                    </p>
                  )}
                </div>

                {/* Quick Copy Key Section */}
                {primaryKey && primaryKey.apiKey && !agent.revokedAt ? (
                  <div className="mt-3 pt-2 border-t border-zk-border/60 flex items-center justify-between text-xs">
                    <span className="text-zk-muted font-mono text-[11px] truncate max-w-[120px]">
                      {primaryKey.prefix}•••
                    </span>
                    <GardenKeyButton
                      apiKey={primaryKey.apiKey}
                      projectId={primaryKey.projectId}
                      projectName={primaryKey.projectName}
                    />
                  </div>
                ) : null}
              </div>

              {/* Action Footer */}
              <div className="mt-4 pt-3 border-t border-zk-border/60 flex items-center justify-between gap-2">
                <Link
                  href={`/settings/agents/${agent.id}/messages`}
                  className="text-xs font-semibold text-zk-muted hover:text-zk-text transition"
                >
                  Logs & Messages
                </Link>

                <div className="flex items-center gap-2">
                  {state === "waiting" ? (
                    <button
                      type="button"
                      onClick={() => setSelectedReviewAgent(agent)}
                      className="px-3 py-1.5 rounded-full bg-electric-blue-strong text-white text-xs font-bold shadow-sm hover:bg-[#2552af] transition cursor-pointer flex items-center gap-1"
                    >
                      <span>Review Plan</span>
                      <span aria-hidden="true">›</span>
                    </button>
                  ) : agent.activeTask?.issueNumber ? (
                    <Link
                      href={`/issues/${agent.activeTask.issueNumber}`}
                      className="px-3 py-1.5 rounded-full border border-zk-border bg-zk-surface hover:bg-zk-chip text-zk-text text-xs font-bold transition"
                    >
                      View Issue ↗
                    </Link>
                  ) : onOpenControls ? (
                    <button
                      type="button"
                      onClick={() => onOpenControls(agent.id)}
                      className="px-3 py-1.5 rounded-full border border-zk-border bg-zk-surface hover:bg-zk-chip text-zk-text text-xs font-semibold transition cursor-pointer"
                    >
                      Settings
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* AISP PLAN REVIEW MODAL */}
      {selectedReviewAgent && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Agent Plan Review"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
        >
          <div className="relative w-full max-w-2xl bg-zk-surface rounded-2xl shadow-2xl border border-zk-border overflow-hidden">
            <div className="p-4 border-b border-zk-border flex items-center justify-between bg-zk-surface">
              <div className="flex items-center gap-2">
                <span className="text-base">🤖</span>
                <span className="font-bold text-sm text-zk-text">
                  Agent Plan Review: {selectedReviewAgent.name}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReviewAgent(null)}
                className="p-1 rounded-lg text-zk-muted hover:text-zk-text hover:bg-zk-chip transition"
                aria-label="Close review modal"
              >
                ✕
              </button>
            </div>

            <div className="p-4">
              <AgentPlanReview
                issueNumber={selectedReviewAgent.activeTask?.issueNumber ?? 688}
                issueTitle={selectedReviewAgent.activeTask?.issueTitle ?? "Integrate Agent Garden state visualization"}
                agentName={selectedReviewAgent.name}
                branchName={`fix/${selectedReviewAgent.activeTask?.issueNumber ?? 688}-agent-garden`}
                onAuthorize={() => {
                  setTimeout(() => setSelectedReviewAgent(null), 1200);
                }}
                onRequestRevision={() => {
                  setTimeout(() => setSelectedReviewAgent(null), 1200);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GardenKeyButton({
  apiKey,
  projectId,
  projectName,
}: {
  apiKey: string;
  projectId: string | null;
  projectName: string | null;
}) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const origin = window.location.origin;
    const value = projectId
      ? agentBootstrapMessage({ origin, apiKey, projectName })
      : apiKey;
    const ok = await copyText(value);
    if (!ok) {
      toast("Couldn't copy the key.", "error");
      return;
    }
    toast(projectId ? "Agent setup copied. Paste it into that agent." : "Key copied.");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-zk-border bg-zk-chip/60 hover:bg-zk-chip text-zk-text text-[11px] font-semibold transition cursor-pointer"
    >
      <span>{copied ? "✓ Copied" : "Copy key"}</span>
    </button>
  );
}

/**
 * Character SVG illustrations for the 5 Agent Garden lifecycle states
 */
function GardenCharacter({ state, name }: { state: AgentGardenState; name: string }) {
  if (state === "waiting") {
    // Polite waving agent with review beacon
    return (
      <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 flex items-center justify-center relative shadow-xs">
        <svg className="w-8 h-8" viewBox="0 0 36 36" fill="none" aria-label={`${name} is awaiting review`}>
          <line x1="18" y1="4" x2="18" y2="8" stroke="#d97706" strokeWidth="2" strokeLinecap="round" />
          <circle cx="18" cy="4" r="2.5" fill="#f59e0b" className="animate-pulse" />
          <rect x="7" y="8" width="22" height="18" rx="6" fill="#fbbf24" stroke="#d97706" strokeWidth="1.5" />
          <rect x="10" y="12" width="16" height="8" rx="3" fill="#1e293b" />
          <circle cx="14" cy="16" r="1.5" fill="#38bdf8" />
          <circle cx="22" cy="16" r="1.5" fill="#38bdf8" />
          <path d="M29 18c1.5-3 3-3 4-2s.5 3-1 4.5l-3 1.5" stroke="#d97706" strokeWidth="1.8" strokeLinecap="round" fill="#fef3c7" />
          <path d="M9 7c-2-2-4 0-3 2 2 0 3-1 3-2z" fill="#10b981" />
        </svg>
        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white shadow-xs">
          !
        </span>
      </div>
    );
  }

  if (state === "working") {
    // Focused bot with propeller & code brackets in eyes
    return (
      <div className="w-12 h-12 rounded-2xl bg-sky-100 dark:bg-sky-950/60 border border-sky-300 dark:border-sky-800 flex items-center justify-center relative shadow-xs">
        <svg className="w-8 h-8 motion-safe:animate-bounce" style={{ animationDuration: "3s" }} viewBox="0 0 36 36" fill="none" aria-label={`${name} is working`}>
          <rect x="7" y="8" width="22" height="18" rx="6" fill="#38bdf8" stroke="#0284c7" strokeWidth="1.5" />
          <rect x="10" y="12" width="16" height="8" rx="3" fill="#0f172a" />
          <path d="M13 14l-1.5 2 1.5 2M23 14l1.5 2-1.5 2" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="18" cy="5" r="2" fill="#0284c7" />
          <line x1="18" y1="5" x2="18" y2="8" stroke="#0284c7" strokeWidth="1.5" />
          <path d="M15 4c2-1 4-1 6 0" stroke="#0284c7" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span className="absolute -bottom-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
      </div>
    );
  }

  if (state === "completed") {
    // Cheerful bot with celebratory blossom badge
    return (
      <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 flex items-center justify-center relative shadow-xs">
        <svg className="w-8 h-8" viewBox="0 0 36 36" fill="none" aria-label={`${name} completed task`}>
          <rect x="7" y="9" width="22" height="17" rx="6" fill="#fde68a" stroke="#d97706" strokeWidth="1.5" />
          <rect x="10" y="13" width="16" height="7" rx="3" fill="#78350f" />
          <path d="M13 17c.5-.8 1.5-.8 2 0M21 17c.5-.8 1.5-.8 2 0" stroke="#fef3c7" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="28" cy="8" r="3" fill="#fbbf24" />
          <circle cx="28" cy="8" r="1.5" fill="#f59e0b" />
          <path d="M28 5v6M25 8h6" stroke="#d97706" strokeWidth="1" />
        </svg>
        <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white shadow-xs">
          ✓
        </span>
      </div>
    );
  }

  if (state === "error") {
    // Friendly bandage & small wrench diagnostic indicator
    return (
      <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 flex items-center justify-center relative shadow-xs">
        <svg className="w-8 h-8" viewBox="0 0 36 36" fill="none" aria-label={`${name} error diagnostic`}>
          <rect x="7" y="9" width="22" height="17" rx="6" fill="#fca5a5" stroke="#e11d48" strokeWidth="1.5" />
          <rect x="10" y="13" width="16" height="7" rx="3" fill="#881337" />
          <circle cx="13.5" cy="16.5" r="1.5" fill="#fecdd3" />
          <circle cx="22.5" cy="16.5" r="2.2" fill="#fecdd3" />
          <line x1="23" y1="20" x2="27" y2="24" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="27" y1="20" x2="23" y2="24" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-xs">
          ⚠
        </span>
      </div>
    );
  }

  if (state === "offline") {
    // Revoked / offline slate robot
    return (
      <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center relative opacity-70">
        <svg className="w-8 h-8" viewBox="0 0 36 36" fill="none" aria-label={`${name} is offline`}>
          <rect x="7" y="9" width="22" height="17" rx="6" fill="#cbd5e1" stroke="#64748b" strokeWidth="1.5" />
          <rect x="10" y="13" width="16" height="7" rx="3" fill="#475569" />
          <line x1="13" y1="16.5" x2="16" y2="16.5" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="20" y1="16.5" x2="23" y2="16.5" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  // Default: Idle resting botanical sprout robot
  return (
    <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 flex items-center justify-center relative shadow-xs">
      <svg className="w-8 h-8 motion-safe:animate-pulse" style={{ animationDuration: "4s" }} viewBox="0 0 36 36" fill="none" aria-label={`${name} is idle`}>
        <path d="M18 7c0-3 3-5 5-4s1 5-2 5c-1 0-3-.5-3-1z" fill="#10b981" />
        <path d="M18 7c0-2-2-4-4-3s-1 4 2 4c1 0 2-.5 2-1z" fill="#34d399" />
        <path d="M18 7v2" stroke="#059669" strokeWidth="1.5" />
        <rect x="7" y="9" width="22" height="17" rx="6" fill="#a7f3d0" stroke="#059669" strokeWidth="1.5" />
        <rect x="10" y="13" width="16" height="7" rx="3" fill="#064e3b" />
        <path d="M13 16.5c.8-.8 1.8-.8 2.5 0M20.5 16.5c.8-.8 1.8-.8 2.5 0" stroke="#6ee7b7" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
      <span className="absolute -bottom-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-slate-300 dark:bg-slate-600 ring-2 ring-white dark:ring-slate-900" />
    </div>
  );
}

function GardenStateBadge({ state }: { state: AgentGardenState }) {
  if (state === "waiting") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
        Needs review
      </span>
    );
  }

  if (state === "working") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Working
      </span>
    );
  }

  if (state === "completed") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
        <span className="font-bold">✓</span>
        Completed
      </span>
    );
  }

  if (state === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
        <span>⚠</span>
        Diagnostics
      </span>
    );
  }

  if (state === "offline") {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700">
        Offline
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
      Idle
    </span>
  );
}
