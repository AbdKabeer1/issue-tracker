"use client";

import { useMemo, useState } from "react";
import {
  WEEKLY_POINTS_TARGET,
  buildPointsSeries,
  type PointHistoryEntry,
  type PointsGranularity,
} from "@/lib/points/history";
import { formatPoints } from "@/lib/points/rules";

const RANGES: { id: PointsGranularity; label: string }[] = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "yearly", label: "Yearly" },
];

const PRESETS: { label: string; days?: number; kind?: "month" | "year" }[] = [
  { label: "Last 7 days", days: 6 },
  { label: "Last 30 days", days: 29 },
  { label: "This month", kind: "month" },
  { label: "Last 3 months", days: 90 },
  { label: "This year", kind: "year" },
];

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function formatRangeLabel(from: string, to: string): string {
  const fmt = (iso: string) => {
    const d = new Date(`${iso}T00:00:00Z`);
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sept",
      "Oct",
      "Nov",
      "Dec",
    ];
    return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  };
  if (!from && !to) return "All dates";
  return `${from ? fmt(from) : "Start"} – ${to ? fmt(to) : "Today"}`;
}

function presetBounds(
  preset: (typeof PRESETS)[number],
  now: Date,
): { from: string; to: string } {
  const today = startOfUtcDay(now);
  const to = isoDate(today);
  if (preset.kind === "month") {
    return {
      from: isoDate(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))),
      to,
    };
  }
  if (preset.kind === "year") {
    return { from: isoDate(new Date(Date.UTC(today.getUTCFullYear(), 0, 1))), to };
  }
  const days = preset.days ?? 6;
  return {
    from: isoDate(new Date(today.getTime() - days * 24 * 60 * 60 * 1000)),
    to,
  };
}

export function PointsChart({
  entries,
  nowIso,
}: {
  /** Serialized PointEntry slices from the server. */
  entries: { createdAt: string; points: number }[];
  /** Server "now" so SSR and client agree on default windows. */
  nowIso?: string;
}) {
  const [granularity, setGranularity] = useState<PointsGranularity>("weekly");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");
  const [datesOpen, setDatesOpen] = useState(false);

  const history: PointHistoryEntry[] = useMemo(
    () =>
      entries.map((e) => ({
        createdAt: new Date(e.createdAt),
        points: e.points,
      })),
    [entries],
  );

  const now = useMemo(() => (nowIso ? new Date(nowIso) : new Date()), [nowIso]);

  const series = useMemo(
    () =>
      buildPointsSeries({
        entries: history,
        granularity,
        from: dateFrom ? new Date(`${dateFrom}T00:00:00Z`) : null,
        to: dateTo ? new Date(`${dateTo}T00:00:00Z`) : null,
        now,
      }),
    [history, granularity, dateFrom, dateTo, now],
  );

  const hasTarget = series.target > 0;
  const max = Math.max(...series.buckets.map((b) => b.points), series.target * 1.15, 1);
  const targetPct = Math.round((series.target / max) * 100);
  const noBars = series.buckets.length === 0;
  const dateActive = Boolean(dateFrom || dateTo || datesOpen);

  return (
    <section
      aria-label="Your points"
      className="flex flex-col gap-5 rounded-[20px] border border-zk-border bg-zk-surface p-[22px]"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-bold text-zk-text">Your points</h2>
          <span className="text-[13px] text-zk-muted">{series.caption}</span>
          {hasTarget ? (
            <div className="mt-2 flex flex-wrap gap-4 text-[13px] text-zk-text2">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-electric-blue-strong" />
                500 reached
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-sky-tint" />
                Below 500
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="inline-block w-4 border-t-2 border-dashed border-zk-text opacity-55"
                  aria-hidden="true"
                />
                Weekly requirement · 500 pts
              </span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={datesOpen}
              onClick={() => {
                setDraftFrom(dateFrom);
                setDraftTo(dateTo);
                setDatesOpen((open) => !open);
              }}
              className={`inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-full px-3.5 text-[13px] font-bold ${
                dateActive
                  ? "border border-electric-blue-strong bg-zk-tint text-zk-accent"
                  : "border border-zk-border bg-zk-surface text-zk-text"
              }`}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
              {formatRangeLabel(dateFrom, dateTo)}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d={datesOpen ? "m18 15-6-6-6 6" : "m6 9 6 6 6-6"} />
              </svg>
            </button>

            {datesOpen ? (
              <div
                role="dialog"
                aria-label="Filter dates"
                className="absolute right-0 top-[50px] z-20 flex w-80 max-w-[calc(100vw-48px)] flex-col gap-3.5 rounded-[20px] border border-zk-border bg-zk-surface p-[18px] shadow-[0_20px_48px_rgba(11,23,51,0.18)]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-extrabold text-zk-text">Date range</span>
                  <button
                    type="button"
                    className="h-[30px] bg-transparent px-2 text-[13px] font-bold text-zk-accent"
                    onClick={() => {
                      setDateFrom("");
                      setDateTo("");
                      setDraftFrom("");
                      setDraftTo("");
                      setDatesOpen(false);
                    }}
                  >
                    Clear
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {PRESETS.map((preset) => {
                    const bounds = presetBounds(preset, now);
                    const on = draftFrom === bounds.from && draftTo === bounds.to;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setDraftFrom(bounds.from);
                          setDraftTo(bounds.to);
                        }}
                        className={`h-8 rounded-full px-3 text-xs font-bold ${
                          on
                            ? "border border-electric-blue-strong bg-electric-blue-strong text-white"
                            : "border border-zk-border bg-zk-surface text-zk-text2"
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <label className="flex flex-col gap-1.5 text-xs font-bold text-zk-muted">
                    From
                    <input
                      type="date"
                      value={draftFrom}
                      max={draftTo || undefined}
                      onChange={(e) => setDraftFrom(e.target.value)}
                      className="h-[42px] rounded-xl border border-zk-border bg-zk-surface px-2.5 text-[13px] font-medium text-zk-text"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-xs font-bold text-zk-muted">
                    To
                    <input
                      type="date"
                      value={draftTo}
                      min={draftFrom || undefined}
                      onChange={(e) => setDraftTo(e.target.value)}
                      className="h-[42px] rounded-xl border border-zk-border bg-zk-surface px-2.5 text-[13px] font-medium text-zk-text"
                    />
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDatesOpen(false)}
                    className="h-10 flex-1 rounded-full border border-zk-border bg-zk-surface font-bold text-zk-text"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDateFrom(draftFrom);
                      setDateTo(draftTo);
                      setDatesOpen(false);
                    }}
                    className="h-10 flex-1 rounded-full border-0 bg-electric-blue-strong font-bold text-white"
                  >
                    Apply
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div
            role="tablist"
            aria-label="Activity range"
            className="flex gap-0.5 rounded-full bg-zk-seg p-1"
          >
            {RANGES.map((range) => {
              const on = granularity === range.id;
              return (
                <button
                  key={range.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setGranularity(range.id)}
                  className={`min-h-[34px] rounded-full border-0 px-3.5 text-[13px] ${
                    on
                      ? "bg-zk-surface font-bold text-zk-text shadow-[0_1px_3px_rgba(21,18,31,0.12)]"
                      : "bg-transparent font-medium text-zk-text2"
                  }`}
                >
                  {range.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col items-end">
            <span className="text-[26px] font-extrabold leading-none tabular-nums text-zk-text">
              {formatPoints(series.total)}
            </span>
            <span className="text-xs text-zk-muted">pts in this range</span>
          </div>
        </div>
      </div>

      {noBars ? (
        <div className="rounded-2xl border border-dashed border-zk-border px-4 py-14 text-center text-sm text-zk-muted">
          No points in this date range. Try a wider range or clear the dates.
        </div>
      ) : (
        <div className="flex items-end gap-3 overflow-x-auto pb-0.5">
          {series.buckets.map((bucket, index) => {
            const last = index === series.buckets.length - 1;
            const met = hasTarget ? bucket.points >= series.target : last;
            const over = hasTarget && bucket.points > series.target;
            const pct =
              bucket.points === 0 ? 0 : Math.max(6, Math.round((bucket.points / max) * 100));
            return (
              <div
                key={`${bucket.start.toISOString()}-${bucket.label}`}
                className="flex min-w-9 flex-1 flex-col items-center gap-2"
              >
                <span className="flex min-h-[34px] flex-col items-center justify-end gap-0.5">
                  {over ? (
                    <span className="rounded-full bg-zk-ok-bg px-1.5 py-px text-[11px] font-bold text-zk-ok-fg">
                      +{formatPoints(bucket.points - WEEKLY_POINTS_TARGET)}
                    </span>
                  ) : null}
                  <span className="text-xs font-semibold tabular-nums text-zk-text2">
                    {formatPoints(bucket.points)}
                  </span>
                </span>
                <div className="relative h-[180px] w-full max-w-12 overflow-hidden rounded-full bg-zk-tint">
                  <div
                    className="absolute inset-x-0 bottom-0 rounded-full"
                    style={{
                      height: `${pct}%`,
                      background: met ? "#2E6FEF" : "#8FC9FF",
                    }}
                  />
                  {hasTarget ? (
                    <div
                      className="absolute inset-x-0 border-t-2 border-dashed border-zk-text opacity-55"
                      style={{ bottom: `${targetPct}%` }}
                      aria-hidden="true"
                    />
                  ) : null}
                </div>
                <span className="whitespace-nowrap text-xs text-zk-muted">{bucket.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
