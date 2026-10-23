"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { PlatformRewardConfig } from "@/lib/points/platform-reward-config";
import {
  savePlatformRewardsAction,
  type PlatformRewardsActionResult,
} from "@/app/(app)/admin/rewards/actions";

/**
 * Super-admin editor for site-wide ledger amounts. Empty/missing platform
 * settings fall back to the hard-coded defaults shown as placeholders.
 */
export function PlatformRewardsForm({
  initial,
  hardCoded,
}: {
  initial: PlatformRewardConfig;
  hardCoded: PlatformRewardConfig;
}) {
  const hard = hardCoded;
  const [state, action, pending] = useActionState<PlatformRewardsActionResult, FormData>(
    savePlatformRewardsAction,
    {},
  );

  return (
    <form action={action} className="space-y-6">
      {state.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900" role="status">
          {state.message}
        </p>
      ) : null}

      <section className="space-y-3 rounded-xl border border-slate-200 bg-card p-4 sm:p-6">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Solver points by severity</h2>
          <p className="text-xs text-slate-500">
            Paid when an issue is resolved. Projects may still override these per project.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              ["solverPointsLow", "Low", initial.solver.low, hard.solver.low],
              ["solverPointsMedium", "Medium", initial.solver.medium, hard.solver.medium],
              ["solverPointsHigh", "High", initial.solver.high, hard.solver.high],
              ["solverPointsCritical", "Critical", initial.solver.critical, hard.solver.critical],
            ] as const
          ).map(([name, label, value, fallback]) => (
            <div key={name}>
              <label htmlFor={name} className="block text-xs text-slate-500">
                {label}
              </label>
              <Input
                id={name}
                name={name}
                type="number"
                min={0}
                max={10000}
                defaultValue={value}
                placeholder={String(fallback)}
                className="mt-1"
              />
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 rounded-xl border border-slate-200 bg-card p-4 sm:grid-cols-2 sm:p-6">
        {(
          [
            ["reporterPoints", "Reporter", initial.reporter, hard.reporter],
            ["reviewerPoints", "Merge reviewer (first)", initial.reviewer, hard.reviewer],
            [
              "confirmationReviewerPoints",
              "Confirmation reviewer (first)",
              initial.confirmationReviewer,
              hard.confirmationReviewer,
            ],
            ["triagerClearPoints", "Triager clear", initial.triagerClear, hard.triagerClear],
            [
              "duplicateMarkerPoints",
              "Duplicate marker",
              initial.duplicateMarker,
              hard.duplicateMarker,
            ],
            ["dispatcherPoints", "Dispatcher", initial.dispatcher, hard.dispatcher],
            ["targetPoints", "Points goal", initial.target, hard.target],
          ] as const
        ).map(([name, label, value, fallback]) => (
          <div key={name}>
            <label htmlFor={name} className="block text-xs font-medium text-slate-600">
              {label}
            </label>
            <Input
              id={name}
              name={name}
              type="number"
              min={name === "targetPoints" ? 1 : 0}
              max={name === "targetPoints" ? 1_000_000 : 10000}
              defaultValue={value}
              placeholder={String(fallback)}
              className="mt-1"
            />
            <p className="mt-1 text-[11px] text-slate-400">Hard-coded default: {fallback}</p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-slate-200 bg-card p-4 sm:p-6">
        <label htmlFor="rewardGuidelines" className="block text-sm font-semibold text-slate-900">
          Guidelines (optional)
        </label>
        <p className="mt-1 text-xs text-slate-500">Shown as site-wide reward guidance where projects do not set their own.</p>
        <Textarea
          id="rewardGuidelines"
          name="rewardGuidelines"
          rows={3}
          defaultValue={initial.guidelines ?? ""}
          className="mt-2"
        />
      </section>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save platform points"}
      </Button>
    </form>
  );
}
