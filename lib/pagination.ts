export const DEFAULT_PAGE_SIZE = 25;

export interface PaginationParams {
  page?: string | string[] | number;
  pageSize?: number;
  totalCount: number;
}

export interface PaginationResult {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  skip: number;
  take: number;
  hasPrev: boolean;
  hasNext: boolean;
  prevPage: number | null;
  nextPage: number | null;
  from: number;
  to: number;
}

export function parsePage(page?: string | string[] | number): number {
  const raw = Array.isArray(page) ? page[0] : page;
  const parsed = typeof raw === "number" ? raw : parseInt(raw ?? "1", 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return Math.floor(parsed);
}

export function calculatePagination({
  page,
  pageSize = DEFAULT_PAGE_SIZE,
  totalCount,
}: PaginationParams): PaginationResult {
  const safeTotal = Math.max(0, Number.isFinite(totalCount) ? Math.floor(totalCount) : 0);
  const safePageSize =
    Number.isFinite(pageSize) && pageSize > 0
      ? Math.floor(pageSize)
      : DEFAULT_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(safeTotal / safePageSize));
  const rawPage = parsePage(page);
  const currentPage = Math.min(rawPage, totalPages);
  const skip = (currentPage - 1) * safePageSize;
  const take = safePageSize;
  const from = safeTotal === 0 ? 0 : skip + 1;
  const to = Math.min(skip + safePageSize, safeTotal);

  return {
    page: currentPage,
    pageSize: safePageSize,
    totalCount: safeTotal,
    totalPages,
    skip,
    take,
    hasPrev: currentPage > 1,
    hasNext: currentPage < totalPages,
    prevPage: currentPage > 1 ? currentPage - 1 : null,
    nextPage: currentPage < totalPages ? currentPage + 1 : null,
    from,
    to,
  };
}

export function buildPaginationUrl(
  basePath: string,
  page: number,
  params: Record<string, string | undefined | null>,
): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== "page") {
      sp.set(key, value);
    }
  }
  if (page > 1) {
    sp.set("page", page.toString());
  }
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/**
 * Returns an array of page numbers and ellipsis tokens to display in pagination UI.
 * e.g., for page 5 of 10: [1, "...", 4, 5, 6, "...", 10]
 */
export function getPaginationRange(
  currentPage: number,
  totalPages: number,
  siblingCount = 1,
): (number | "...")[] {
  if (totalPages <= 5 + siblingCount * 2) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const leftSiblingIndex = Math.max(currentPage - siblingCount, 1);
  const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages);

  const shouldShowLeftDots = leftSiblingIndex > 2;
  const shouldShowRightDots = rightSiblingIndex < totalPages - 1;

  if (!shouldShowLeftDots && shouldShowRightDots) {
    const leftItemCount = 3 + 2 * siblingCount;
    const leftRange = Array.from({ length: leftItemCount }, (_, i) => i + 1);
    return [...leftRange, "...", totalPages];
  }

  if (shouldShowLeftDots && !shouldShowRightDots) {
    const rightItemCount = 3 + 2 * siblingCount;
    const rightRange = Array.from(
      { length: rightItemCount },
      (_, i) => totalPages - rightItemCount + i + 1,
    );
    return [1, "...", ...rightRange];
  }

  const middleRange = Array.from(
    { length: rightSiblingIndex - leftSiblingIndex + 1 },
    (_, i) => leftSiblingIndex + i,
  );
  return [1, "...", ...middleRange, "...", totalPages];
}

