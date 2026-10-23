"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reopenAgentResolvedAction } from "@/app/actions/issues";
import { Button } from "@/components/ui/button";
import type { AgentResolution } from "@/lib/agent-resolution";

/**
 * Ziki #515: says which agent resolved the issue and with which merged pull
 * request, and lets someone who may change the status undo it in one click.
 */
export function AgentResolvedNotice({
  bugId,
  resolution,
  canReopen,
}: {
  bugId: string;
  resolution: AgentResolution;
  canReopen: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function reopen() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await reopenAgentResolvedAction(bugId);
        if (result.error) setError(result.error);
        else router.refresh();
      } catch {
        setError("Could not reopen the issue. Please try again.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zk-border bg-zk-chip px-3 py-2 text-sm text-zk-text">
      <p className="min-w-0 flex-1">
        Resolved by <span className="font-medium">{resolution.agentName}</span> because{" "}
        <a
          href={resolution.pullRequestUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-zk-accent underline underline-offset-2 break-all"
        >
          its pull request
        </a>{" "}
        was merged.
      </p>
      {canReopen ? (
        <Button type="button" variant="secondary" disabled={pending} onClick={reopen}>
          {pending ? "Reopening…" : "Reopen"}
        </Button>
      ) : null}
      {error ? (
        <p role="alert" className="w-full text-sm text-zk-bad-fg">
          {error}
        </p>
      ) : null}
    </div>
  );
}
