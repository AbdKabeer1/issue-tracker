"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/toast";
import { copyText } from "@/lib/clipboard";
import { agentBootstrapMessage } from "@/lib/agents/bootstrap-message";

/** One live key on the agents list. The secret is copied, not printed. */
export function AgentRowKey({
  apiKey,
  prefix,
  projectId,
  projectName,
}: {
  apiKey: string | null;
  prefix: string;
  projectId: string | null;
  projectName: string | null;
}) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!apiKey) return;
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

  if (!apiKey) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-full border border-zk-warn-bd bg-zk-warn-bg/40 px-3 py-1.5">
        <span className="font-mono text-[11px] font-semibold text-zk-text2">{prefix}…</span>
        <span className="text-xs font-semibold text-zk-warn-fg">Not copyable</span>
        <span className="text-xs text-zk-muted">
          Issued before it could be copied again. Regenerate it — the new key stays on this row.
        </span>
      </div>
    );
  }

  return (
    <div className="inline-flex max-w-full flex-wrap items-center gap-2 rounded-full border border-zk-border bg-zk-chip px-1.5 py-1">
      <span className="rounded-full bg-zk-surface px-2.5 py-1 font-mono text-[11px] font-semibold text-zk-text ring-1 ring-zk-border">
        {prefix}…
      </span>
      <span className="text-xs text-zk-muted">
        {projectName ?? (projectId ? "This project" : "Every project")}
      </span>
      <button
        type="button"
        onClick={copy}
        aria-label="Copy key"
        className="inline-flex min-h-9 items-center rounded-full bg-electric-blue-strong px-3 text-xs font-bold text-white transition hover:bg-[#2552af] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-blue focus-visible:ring-offset-2"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
