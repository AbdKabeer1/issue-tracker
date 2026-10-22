"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { createTestMissionAction, type ProjectActionResult } from "./actions";

type MissionRow = {
  id: string;
  routePattern: string;
  brief: string;
  role: "admin" | "member" | "signed_out";
  viewport: "desktop" | "mobile_375";
  lastCoveredAt: string | null;
  issuesFiled: number;
};

const roleLabels = { admin: "Admin", member: "Member", signed_out: "Signed out" } as const;
const viewportLabels = { desktop: "Desktop", mobile_375: "375 px" } as const;

function coverageLabel(lastCoveredAt: string | null) {
  if (!lastCoveredAt) return { label: "Never covered", style: "bg-slate-100 text-slate-700" };
  const hours = (Date.now() - new Date(lastCoveredAt).getTime()) / 3_600_000;
  if (hours < 24) return { label: "Covered in the last day", style: "bg-emerald-50 text-emerald-800" };
  if (hours < 24 * 7) return { label: "Covered this week", style: "bg-amber-50 text-amber-800" };
  return { label: "Needs coverage", style: "bg-rose-50 text-rose-800" };
}

export function MissionCoverage({
  projectId,
  missions,
  canManage,
}: {
  projectId: string;
  missions: MissionRow[];
  canManage: boolean;
}) {
  const [result, action, pending] = useActionState<ProjectActionResult | undefined, FormData>(
    createTestMissionAction,
    undefined,
  );

  return (
    <details className="mt-4 rounded-lg border border-slate-200 bg-slate-50">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-slate-800">
        Exploratory test coverage <span className="text-slate-500">({missions.length} missions)</span>
      </summary>
      <div className="space-y-4 border-t border-slate-200 p-3">
        {missions.length === 0 ? (
          <p className="text-sm text-slate-600">No route missions are configured for this project yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-xs">
              <thead className="text-slate-600">
                <tr>
                  <th scope="col" className="px-2 py-2 font-medium">Route</th>
                  <th scope="col" className="px-2 py-2 font-medium">Role</th>
                  <th scope="col" className="px-2 py-2 font-medium">Viewport</th>
                  <th scope="col" className="px-2 py-2 font-medium">Coverage</th>
                  <th scope="col" className="px-2 py-2 font-medium">Issues filed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {missions.map((mission) => {
                  const coverage = coverageLabel(mission.lastCoveredAt);
                  return (
                    <tr key={mission.id}>
                      <td className="max-w-48 px-2 py-2 align-top">
                        <code className="break-all text-slate-900">{mission.routePattern}</code>
                        <p className="mt-1 text-slate-500">{mission.brief}</p>
                      </td>
                      <td className="px-2 py-2 align-top">{roleLabels[mission.role]}</td>
                      <td className="px-2 py-2 align-top">{viewportLabels[mission.viewport]}</td>
                      <td className="px-2 py-2 align-top">
                        <span className={`inline-flex rounded-full px-2 py-1 ${coverage.style}`}>
                          {coverage.label}
                        </span>
                      </td>
                      <td className="px-2 py-2 align-top tabular-nums">{mission.issuesFiled}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {canManage ? (
          <form action={action} className="space-y-3 rounded-md border border-slate-200 bg-card p-3">
            <input type="hidden" name="projectId" value={projectId} />
            <h3 className="text-sm font-medium text-slate-900">Add route missions</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs font-medium text-slate-700">
                <span>Route pattern</span>
                <input
                  name="routePattern"
                  required
                  maxLength={240}
                  placeholder="/settings/**"
                  className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm"
                />
              </label>
              <label className="space-y-1 text-xs font-medium text-slate-700">
                <span>Testing brief</span>
                <input
                  name="brief"
                  required
                  maxLength={500}
                  placeholder="Check settings navigation and save behavior"
                  className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm"
                />
              </label>
            </div>
            <fieldset className="space-y-1">
              <legend className="text-xs font-medium text-slate-700">Target role</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {Object.entries(roleLabels).map(([value, label]) => (
                  <label key={value} className="flex items-center gap-1.5 text-xs text-slate-700">
                    <input type="checkbox" name="roles" value={value} defaultChecked /> {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="space-y-1">
              <legend className="text-xs font-medium text-slate-700">Viewport</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {Object.entries(viewportLabels).map(([value, label]) => (
                  <label key={value} className="flex items-center gap-1.5 text-xs text-slate-700">
                    <input type="checkbox" name="viewports" value={value} defaultChecked /> {label}
                  </label>
                ))}
              </div>
            </fieldset>
            {result?.error ? <p className="text-xs text-red-700" role="alert">{result.error}</p> : null}
            {result?.message ? <p className="text-xs text-emerald-800" role="status">{result.message}</p> : null}
            <Button type="submit" variant="secondary" disabled={pending}>
              {pending ? "Adding…" : "Add selected missions"}
            </Button>
          </form>
        ) : null}
      </div>
    </details>
  );
}
