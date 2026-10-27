"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BASE_PATH } from "@/lib/base-path";

export type IssueApprovalView = {
  id: string;
  stage: string;
  status: string;
  rule?: {
    issueType?: { name: string } | null;
    severity?: string | null;
    fileGlob?: string | null;
  } | null;
};

export function IssueApprovalBanner({
  approval,
  canDecide,
}: {
  approval: IssueApprovalView;
  canDecide: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function handleDecision(decision: "approved" | "rejected") {
    setPending(true);
    setError("");
    try {
      const response = await fetch(
        `${BASE_PATH}/api/v1/approvals/${encodeURIComponent(approval.id)}/decision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision }),
        },
      );
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error ?? `Could not save decision (${decision}).`);
      }
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Decision failed.");
    } finally {
      setPending(false);
    }
  }

  const stageLabel =
    approval.stage === "before_merge"
      ? "before its pull request is merged"
      : "before it can be offered to agents";

  const ruleReasons: string[] = [];
  if (approval.rule?.issueType?.name) {
    ruleReasons.push(`type: ${approval.rule.issueType.name}`);
  }
  if (approval.rule?.severity) {
    ruleReasons.push(`severity: ${approval.rule.severity}`);
  }
  if (approval.rule?.fileGlob) {
    ruleReasons.push(`files matching: ${approval.rule.fileGlob}`);
  }

  return (
    <section
      aria-label="Human approval required"
      className="flex flex-col gap-3 rounded-[4px] border border-[#ad8551] bg-[#f7ecd7] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#c4862b]" aria-hidden="true" />
          <h2 className="text-sm font-bold text-[#8a5b16]">
            Human approval required
          </h2>
        </div>
        <p className="text-sm text-[#5d665f]">
          This issue requires workspace approval {stageLabel}.
          {ruleReasons.length ? (
            <span className="ml-1 text-xs text-[#8a5b16]">
              ({ruleReasons.join(", ")})
            </span>
          ) : null}
        </p>
        {error ? (
          <p role="alert" className="text-xs font-medium text-[#923a2e]">
            {error}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {canDecide ? (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => handleDecision("approved")}
              className="inline-flex min-h-10 items-center justify-center rounded-[2px] border border-[#5f4728] bg-[#ad8551] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em] text-[#fff9ec] shadow-[0_2px_0_#6b5030] hover:bg-[#9a7443] disabled:opacity-50"
            >
              {pending ? "Saving…" : "Approve"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => handleDecision("rejected")}
              className="inline-flex min-h-10 items-center justify-center rounded-[2px] border border-[#ad8551] bg-transparent px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em] text-[#5d665f] hover:bg-[#f1e6cf] disabled:opacity-50"
            >
              {pending ? "Saving…" : "Reject"}
            </button>
          </>
        ) : (
          <span className="text-xs italic text-[#8a5b16]">
            Waiting for workspace owner or admin decision
          </span>
        )}
      </div>
    </section>
  );
}
