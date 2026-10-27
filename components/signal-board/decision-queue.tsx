"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BASE_PATH } from "@/lib/base-path";
import type { SignalDecision } from "@/lib/signal-board";

function DecisionCard({
  decision,
  canDecide,
}: {
  decision: SignalDecision;
  canDecide: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"approved" | "rejected" | null>(null);
  const [confirmReject, setConfirmReject] = useState(false);
  const [error, setError] = useState("");

  async function submit(value: "approved" | "rejected") {
    setPending(value);
    setError("");
    try {
      const response = await fetch(
        `${BASE_PATH}/api/v1/approvals/${encodeURIComponent(decision.id)}/decision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision: value }),
        },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Could not save the decision.");
      }
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not save the decision.");
    } finally {
      setPending(null);
      setConfirmReject(false);
    }
  }

  return (
    <article className="sb2-decision" aria-label={`Decision for #${decision.issueNumber}`}>
      <header className="sb2-decision-kicker">
        <span>Feature · #{decision.issueNumber}</span>
        <span>{decision.stage === "before_merge" ? "Before merge" : "Before offer"}</span>
      </header>
      <h2>{decision.issueTitle}</h2>
      {decision.ruleReason ? <p className="sb2-decision-reason">{decision.ruleReason}</p> : null}
      <p className="sb2-decision-copy">
        Approving lets the agent proceed. Rejecting stops this stage.
      </p>

      {canDecide ? (
        confirmReject ? (
          <div className="sb2-decision-confirm">
            <p>
              This stops the stage. The agent will not retry automatically.
            </p>
            <div className="sb2-decision-actions">
              <button
                type="button"
                className="sb2-button sb2-button-reject"
                disabled={pending !== null}
                onClick={() => submit("rejected")}
              >
                {pending === "rejected" ? "Saving…" : "Reject anyway"}
              </button>
              <button
                type="button"
                className="sb2-button sb2-button-ghost"
                disabled={pending !== null}
                onClick={() => setConfirmReject(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="sb2-decision-actions">
            <button
              type="button"
              className="sb2-button sb2-button-approve"
              disabled={pending !== null}
              onClick={() => submit("approved")}
            >
              {pending === "approved" ? "Saving…" : "Approve"}
            </button>
            <button
              type="button"
              className="sb2-button sb2-button-ghost"
              disabled={pending !== null}
              onClick={() => setConfirmReject(true)}
            >
              Reject
            </button>
          </div>
        )
      ) : (
        <p className="sb2-decision-locked">Waiting for an owner or admin.</p>
      )}

      {error ? (
        <p role="alert" className="sb2-decision-error">
          {error}
        </p>
      ) : null}
    </article>
  );
}

export function DecisionQueue({
  decisions,
  canDecide,
}: {
  decisions: SignalDecision[];
  canDecide: boolean;
}) {
  return (
    <section className="sb2-queue" aria-label="Decision queue">
      <header className="sb2-section-head">
        <span className="sb2-label">Decision queue</span>
        <span className="sb2-muted">{decisions.length} waiting</span>
      </header>

      {decisions.length === 0 ? (
        <div className="sb2-empty sb2-empty-dark">
          <b>No decisions waiting.</b>
          <p>The line is clear.</p>
        </div>
      ) : (
        <div className="sb2-decision-list">
          {decisions.map((decision) => (
            <DecisionCard key={decision.id} decision={decision} canDecide={canDecide} />
          ))}
        </div>
      )}
    </section>
  );
}
