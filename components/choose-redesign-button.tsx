"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BASE_PATH } from "@/lib/base-path";

export function ChooseRedesignButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function choose() {
    setPending(true);
    setError("");
    try {
      const response = await fetch(`${BASE_PATH}/api/v1/redesigns/${encodeURIComponent(id)}/decision`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision: "chosen" }),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error ?? "Could not choose this design.");
      }
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not choose this design.");
    } finally {
      setPending(false);
    }
  }

  return <div className="space-y-2">
    <button type="button" disabled={pending} onClick={choose} className="rounded bg-indigo-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
      {pending ? "Choosing…" : "Choose this design"}
    </button>
    {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
  </div>;
}
