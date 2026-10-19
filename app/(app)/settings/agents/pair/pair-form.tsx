"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { pairAgentAction, type PairingActionResult } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Approve an agent that asked to pair (#427): type the code it shows, check
 * the name, approve. The agent then collects its own key.
 */
export function PairForm({ initialCode }: { initialCode: string }) {
  const [code, setCode] = useState(initialCode);
  const [result, action, pending] = useActionState<PairingActionResult | undefined, FormData>(
    pairAgentAction,
    undefined,
  );

  if (result?.ok && result.step === "done") {
    return (
      <div className="mt-4 space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4" role="status">
        <p className="text-sm font-medium text-slate-900">
          {result.name} is paired with your account.
        </p>
        <p className="text-sm text-slate-700">
          It will pick up its key on its next check, within a few seconds. It starts as an observer.
        </p>
        <Link href="/settings/agents" className="text-sm font-medium text-teal-700 hover:underline">
          See your agents
        </Link>
      </div>
    );
  }

  if (result?.ok && result.step === "confirm") {
    return (
      <form action={action} className="mt-4 space-y-3 rounded-lg border border-slate-200 p-4">
        <input type="hidden" name="code" value={result.code} />
        <input type="hidden" name="intent" value="approve" />
        <p className="text-sm text-slate-800">
          Approve <span className="font-semibold">{result.name}</span>
          {result.model ? ` (${result.model})` : ""} as an agent working for you?
        </p>
        <p className="text-xs text-slate-600">
          Only approve an agent you started yourself. It will act on Ziki in your name.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Approving…" : "Approve"}
          </Button>
          <Link
            href="/settings/agents"
            className="inline-flex items-center rounded-lg px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </Link>
        </div>
      </form>
    );
  }

  const error = result && !result.ok ? result.error : null;
  return (
    <form action={action} className="mt-4 space-y-3" noValidate>
      <label htmlFor="pair-code" className="block text-sm font-medium text-slate-800">
        Code from your agent
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="pair-code"
          name="code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="ABCD-2345"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="font-mono uppercase sm:max-w-xs"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "pair-error" : undefined}
          required
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Checking…" : "Continue"}
        </Button>
      </div>
      {error ? (
        <p id="pair-error" className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
