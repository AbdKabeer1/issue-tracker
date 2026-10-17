import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth-helpers";
import { fetchDashboard, type Breakdown, type WeekPoint } from "@/lib/dashboard-queries";
import {
  RANGE_PRESETS,
  formatDateParam,
  formatDuration,
  isPreset,
  parseDateRange,
  presetRange,
} from "@/lib/dashboard-range";
import { severityLabel, statusLabel } from "@/lib/labels";

export const metadata: Metadata = { title: "Dashboard" };

type SearchParams = Promise<{
  from?: string | string[];
  to?: string | string[];
}>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  await requireAdmin();

  const params = searchParams ? await searchParams : {};
  const range = parseDateRange({ from: one(params.from), to: one(params.to) });
  const data = await fetchDashboard(range);

  const statusTotal = data.byStatus.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/admin" className="text-sm text-teal-700 hover:underline">
          ← Back to admin
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-600">
          Issues created between{" "}
          <span className="font-medium text-slate-800">
            {formatDateParam(range.from)}
          </span>{" "}
          and{" "}
          <span className="font-medium text-slate-800">
            {formatDateParam(new Date(range.to.getTime() - 86400000))}
          </span>
          . Deleted issues are excluded.
        </p>
      </div>

      <RangePicker range={range} />

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Opened" value={String(data.totalOpened)} />
        <Stat label="Closed" value={String(data.totalClosed)} />
        <Stat
          label="Median time to first reply"
          value={formatDuration(data.medianFirstResponseSeconds) ?? "—"}
          hint={
            data.medianFirstResponseSeconds === null
              ? "Nothing in range has a reply yet"
              : undefined
          }
        />
        <Stat
          label="Median time to resolution"
          value={formatDuration(data.medianResolutionSeconds) ?? "—"}
          hint={
            data.medianResolutionSeconds === null
              ? "Nothing in range has been resolved yet"
              : undefined
          }
        />
      </dl>

      <WeeklyChart points={data.weekly} />

      <div className="grid gap-4 lg:grid-cols-3">
        <BreakdownCard
          title="By status"
          rows={data.byStatus.map((s) => ({
            label: statusLabel[s.status as keyof typeof statusLabel] ?? s.status,
            count: s.count,
          }))}
          total={statusTotal}
        />
        <BreakdownCard
          title="By severity"
          rows={data.bySeverity.map((s) => ({
            label:
              severityLabel[s.label as keyof typeof severityLabel] ?? s.label,
            count: s.count,
          }))}
          total={statusTotal}
        />
        <BreakdownCard title="By platform" rows={data.byPlatform} total={statusTotal} />
      </div>

      <BreakdownCard title="By type" rows={data.byType} total={statusTotal} wide />
    </div>
  );
}

function RangePicker({ range }: { range: ReturnType<typeof parseDateRange> }) {
  return (
    <nav aria-label="Date range" className="flex flex-wrap items-center gap-2">
      {RANGE_PRESETS.map((preset) => {
        const target = presetRange(preset.days);
        const active = isPreset(range, preset.days);
        return (
          <Link
            key={preset.days}
            href={`/admin/dashboard?from=${formatDateParam(target.from)}&to=${formatDateParam(
              new Date(target.to.getTime() - 86400000),
            )}`}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
              active
                ? "border-teal-700 bg-teal-700 text-white"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {preset.label}
          </Link>
        );
      })}
      <form
        action="/admin/dashboard"
        className="flex flex-wrap items-end gap-2 sm:ml-2"
      >
        <label className="text-xs font-medium text-slate-600">
          <span className="mb-1 block">From</span>
          <input
            type="date"
            name="from"
            defaultValue={formatDateParam(range.from)}
            className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-900"
          />
        </label>
        <label className="text-xs font-medium text-slate-600">
          <span className="mb-1 block">To</span>
          <input
            type="date"
            name="to"
            defaultValue={formatDateParam(new Date(range.to.getTime() - 86400000))}
            className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-900"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Apply
        </button>
      </form>
    </nav>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
        {value}
        {hint ? (
          <span className="mt-1 block text-xs font-normal normal-case tracking-normal text-slate-500">
            {hint}
          </span>
        ) : null}
      </dd>
    </div>
  );
}

const WEEK_LABEL = (week: Date) =>
  week.toISOString().slice(0, 10);

function WeeklyChart({ points }: { points: WeekPoint[] }) {
  const peak = Math.max(1, ...points.map((p) => Math.max(p.opened, p.closed)));
  const width = Math.max(points.length * 28, 120);
  const height = 140;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Opened vs closed, by week
      </h2>
      <p className="mt-1 flex flex-wrap items-center gap-4 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-teal-700" />
          Opened
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-slate-400" />
          Closed
        </span>
      </p>

      {points.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No weeks in this range.</p>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto">
            {/*
              The chart is decorative: every number in it is in the table
              below, which is the accessible version rather than a summary
              of one. So it is hidden from assistive technology instead of
              being given a label that cannot carry the data anyway.
            */}
            <svg
              viewBox={`0 0 ${width} ${height}`}
              width={width}
              height={height}
              role="presentation"
              aria-hidden="true"
              className="max-w-full"
            >
              {points.map((point, index) => {
                const x = index * 28 + 4;
                const openedH = Math.round((point.opened / peak) * (height - 24));
                const closedH = Math.round((point.closed / peak) * (height - 24));
                return (
                  <g key={point.week.toISOString()}>
                    <rect
                      x={x}
                      y={height - 16 - openedH}
                      width={9}
                      height={openedH}
                      rx={1.5}
                      className="fill-teal-700"
                    />
                    <rect
                      x={x + 11}
                      y={height - 16 - closedH}
                      width={9}
                      height={closedH}
                      rx={1.5}
                      className="fill-slate-400"
                    />
                  </g>
                );
              })}
              <line
                x1={0}
                y1={height - 16}
                x2={width}
                y2={height - 16}
                className="stroke-slate-200"
                strokeWidth={1}
              />
            </svg>
          </div>

          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium text-teal-700 hover:underline">
              Show the figures
            </summary>
            <div className="mt-2 overflow-x-auto">
              <table className="min-w-full text-sm">
                <caption className="sr-only">
                  Issues opened and closed each week
                </caption>
                <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="py-1.5 pr-4">Week beginning</th>
                    <th scope="col" className="py-1.5 pr-4 text-right">Opened</th>
                    <th scope="col" className="py-1.5 text-right">Closed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {points.map((point) => (
                    <tr key={point.week.toISOString()}>
                      <th scope="row" className="py-1.5 pr-4 font-normal text-slate-700">
                        {WEEK_LABEL(point.week)}
                      </th>
                      <td className="py-1.5 pr-4 text-right tabular-nums">{point.opened}</td>
                      <td className="py-1.5 text-right tabular-nums">{point.closed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}

function BreakdownCard({
  title,
  rows,
  total,
  wide = false,
}: {
  title: string;
  rows: Breakdown[];
  total: number;
  wide?: boolean;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Nothing in this range.</p>
      ) : (
        <table className={`mt-3 w-full text-sm ${wide ? "max-w-2xl" : ""}`}>
          <caption className="sr-only">{title}</caption>
          <thead className="sr-only">
            <tr>
              <th scope="col">Group</th>
              <th scope="col">Issues</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row" className="py-1 pr-3 text-left font-normal text-slate-700">
                  {row.label}
                </th>
                <td className="w-full py-1 pr-3">
                  {/* Width is a visual echo of the number beside it, so it
                      carries no information of its own. */}
                  <span
                    aria-hidden="true"
                    className="block h-2 rounded-sm bg-teal-600/70"
                    style={{
                      width: `${total > 0 ? Math.max(2, (row.count / total) * 100) : 0}%`,
                    }}
                  />
                </td>
                <td className="py-1 text-right tabular-nums text-slate-900">
                  {row.count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
