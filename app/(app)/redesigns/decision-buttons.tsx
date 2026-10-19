"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BASE_PATH } from "@/lib/base-path";

export function DecisionButtons({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function decide(decision: "approved" | "rejected") {
    setPending(true);
    setError("");
    try {
      const response = await fetch(`${BASE_PATH}/api/v1/redesigns/${encodeURIComponent(id)}/decision`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision }),
      });
      if (!response.ok) { const result = await response.json(); throw new Error(result.error ?? "Could not save your decision."); }
      router.refresh();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not save your decision."); }
    finally { setPending(false); }
  }
  return <div className="space-y-3">
    <div className="flex gap-3">
      <button type="button" disabled={pending} onClick={() => decide("approved")} className="rounded bg-indigo-700 px-4 py-2 text-white disabled:opacity-50">Approve</button>
      <button type="button" disabled={pending} onClick={() => decide("rejected")} className="rounded border border-slate-300 px-4 py-2 disabled:opacity-50">Reject</button>
    </div>
    {error && <p role="alert" className="text-red-700">{error}</p>}
  </div>;
}
