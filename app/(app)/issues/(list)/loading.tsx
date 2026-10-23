/**
 * Instant placeholder while the issues list loads (#214), shaped like the
 * list so the layout doesn't jump when content arrives.
 *
 * It lives in the (list) route group, not app/(app)/, on purpose: a loading
 * boundary makes the route stream, and once streaming has started a later
 * notFound() can no longer send a 404 status. Issue pages call notFound(),
 * so they're kept outside this boundary.
 */
export default function AppLoading() {
  return (
    <div className="space-y-5" role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="flex flex-wrap items-start justify-between gap-4" aria-hidden="true">
        <div className="space-y-2">
          <div className="h-8 w-32 rounded-lg bg-zk-chip motion-safe:animate-pulse" />
          <div className="h-4 w-64 rounded bg-zk-divider motion-safe:animate-pulse" />
        </div>
        <div className="h-[42px] w-28 rounded-full bg-zk-chip motion-safe:animate-pulse" />
      </div>
      <div className="h-[42px] rounded-full bg-zk-seg motion-safe:animate-pulse" aria-hidden="true" />
      <div className="rounded-[20px] border border-zk-border bg-zk-surface p-5" aria-hidden="true">
        <div className="mb-3 h-10 rounded-full bg-zk-tint motion-safe:animate-pulse" />
        <ul className="space-y-0">
          {Array.from({ length: 5 }, (_, i) => (
            <li key={i} className="flex items-center gap-4 border-b border-zk-divider py-3.5 last:border-0">
              <div className="h-9 w-[52px] shrink-0 rounded-full bg-zk-chip motion-safe:animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-2/3 rounded bg-zk-chip motion-safe:animate-pulse" />
                <div className="h-3 w-1/3 rounded bg-zk-divider motion-safe:animate-pulse" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
