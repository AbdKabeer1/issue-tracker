"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useId, useState } from "react";
import type { UndoAuditActionResult } from "@/app/actions/audit";
import { LocalTime } from "@/components/local-time";

/** One agent audit event, already filtered for the viewer on the server (#447). */
export type AuditLogRow = {
  id: string;
  createdAt: Date | string;
  agentName: string;
  action: string;
  /** Human-readable target, e.g. "#42 Login button overlaps". */
  target: string | null;
  /** Link for the target issue, when there is one. */
  issueHref: string | null;
  agentId: string;
  bugId: string | null;
  payload: unknown;
  undoneAt: Date | string | null;
};

type UndoAction = (
  prev: UndoAuditActionResult | undefined,
  formData: FormData,
) => Promise<UndoAuditActionResult>;

function formatPayload(payload: unknown): string {
  if (payload === null || payload === undefined) return "(no payload)";
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

function AuditLogEntry({
  row,
  isTenantAdmin,
  onUndo,
}: {
  row: AuditLogRow;
  isTenantAdmin?: boolean;
  onUndo?: UndoAction;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const detailsId = useId();

  const handleUndo = async () => {
    const formData = new FormData();
    formData.append("auditEventId", row.id);
    startTransition(async () => {
      await onUndo?.(undefined, formData);
    });
  };

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
        <LocalTime date={row.createdAt} className="text-xs text-slate-500" />
        <span className="font-medium text-slate-900">{row.agentName}</span>
        <span className="text-slate-700">{row.action}</span>
        {row.target &&
          (row.issueHref ? (
            <Link href={row.issueHref} className="text-teal-700 underline-offset-2 hover:underline">
              {row.target}
            </Link>
          ) : (
            <span className="text-slate-700">{row.target}</span>
          ))}
        {row.undoneAt && (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">Undone</span>
        )}
        {isTenantAdmin && !row.undoneAt ? (
          <button
            type="button"
            disabled={pending}
            onClick={handleUndo}
            className="ml-auto text-xs font-medium text-red-700 hover:underline disabled:opacity-50"
          >
            {pending ? "Undoing…" : "Undo"}
          </button>
        ) : null}
        <button
          type="button"
          className="ml-auto text-xs font-medium text-teal-700 hover:underline"
          aria-expanded={open}
          aria-controls={detailsId}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Show less" : "Show more"}
        </button>
      </div>
      {open && (
        <dl id={detailsId} className="mt-2 space-y-1 rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
          <div>
            <dt className="inline font-medium">Event id: </dt>
            <dd className="inline font-mono">{row.id}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Agent id: </dt>
            <dd className="inline font-mono">{row.agentId}</dd>
          </div>
          {row.bugId && (
            <div>
              <dt className="inline font-medium">Issue id: </dt>
              <dd className="inline font-mono">{row.bugId}</dd>
            </div>
          )}
          <div>
            <dt className="inline font-medium">Undone: </dt>
            <dd className="inline">
              {row.undoneAt ? <LocalTime date={row.undoneAt} /> : "No"}
            </dd>
          </div>
          <div>
            <dt className="font-medium">Payload</dt>
            <dd>
              <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words font-mono">
                {formatPayload(row.payload)}
              </pre>
            </dd>
          </div>
        </dl>
      )}
    </li>
  );
}

/** Compact audit rows, each collapsed until its "Show more" button is pressed. */
export function AuditLog({
  rows,
  isTenantAdmin,
  onUndo,
}: {
  rows: ReadonlyArray<AuditLogRow>;
  isTenantAdmin?: boolean;
  onUndo?: UndoAction;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">No agent activity yet.</p>;
  }
  return (
    <ul className="divide-y divide-slate-200">
      {rows.map((row) => (
        <AuditLogEntry key={row.id} row={row} isTenantAdmin={isTenantAdmin} onUndo={onUndo} />
      ))}
    </ul>
  );
}
