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
    <div className="space-y-6" role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="flex items-center justify-between gap-3" aria-hidden="true">
        <div className="h-4 w-40 rounded bg-slate-200 motion-safe:animate-pulse" />
        <div className="h-9 w-28 rounded-lg bg-slate-200 motion-safe:animate-pulse" />
      </div>
      <div className="h-12 rounded-lg bg-slate-100 motion-safe:animate-pulse" aria-hidden="true" />
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-card" aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => (
          <li key={i} className="flex items-center gap-4 p-4">
            <div className="h-10 w-10 shrink-0 rounded-lg bg-slate-100 motion-safe:animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/3 rounded bg-slate-200 motion-safe:animate-pulse" />
              <div className="h-3 w-1/3 rounded bg-slate-100 motion-safe:animate-pulse" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
