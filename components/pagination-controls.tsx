import Link from "next/link";
import { buildPaginationUrl, getPaginationRange } from "@/lib/pagination";

export interface PaginationControlsProps {
  page: number;
  totalPages: number;
  totalCount: number;
  from: number;
  to: number;
  queryParams: Record<string, string | undefined>;
  /** Route the page links point at. Defaults to the issues list. */
  basePath?: string;
  /** Singular noun for the "Showing 1-25 of 60 …" line. */
  itemLabel?: string;
}

export function PaginationControls({
  page,
  totalPages,
  totalCount,
  from,
  to,
  queryParams,
  basePath = "/bugs",
  itemLabel = "issue",
}: PaginationControlsProps) {
  if (totalCount === 0) return null;

  const range = getPaginationRange(page, totalPages);
  const prevUrl = page > 1 ? buildPaginationUrl(basePath, page - 1, queryParams) : null;
  const nextUrl =
    page < totalPages ? buildPaginationUrl(basePath, page + 1, queryParams) : null;

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="text-xs text-slate-600">
        Showing <span className="font-medium text-slate-900">{from}</span>–
        <span className="font-medium text-slate-900">{to}</span> of{" "}
        <span className="font-medium text-slate-900">{totalCount}</span>{" "}
        {itemLabel}
        {totalCount === 1 ? "" : "s"}
      </div>

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {prevUrl ? (
            <Link
              href={prevUrl}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:outline-none"
            >
              Previous
            </Link>
          ) : (
            <span
              aria-disabled="true"
              className="inline-flex cursor-not-allowed items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-400"
            >
              Previous
            </span>
          )}

          <div className="flex items-center gap-1">
            {range.map((item, index) => {
              if (item === "...") {
                return (
                  <span
                    key={`ellipsis-${index}`}
                    className="px-1.5 text-xs text-slate-500"
                  >
                    …
                  </span>
                );
              }

              const isCurrent = item === page;
              const url = buildPaginationUrl(basePath, item, queryParams);

              return isCurrent ? (
                <span
                  key={item}
                  aria-current="page"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-teal-700 text-xs font-medium text-white"
                >
                  {item}
                </span>
              ) : (
                <Link
                  key={item}
                  href={url}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:outline-none"
                >
                  {item}
                </Link>
              );
            })}
          </div>

          {nextUrl ? (
            <Link
              href={nextUrl}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:outline-none"
            >
              Next
            </Link>
          ) : (
            <span
              aria-disabled="true"
              className="inline-flex cursor-not-allowed items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-400"
            >
              Next
            </span>
          )}
        </div>
      )}
    </nav>
  );
}

