/**
 * Visually distinct admin marker: text label + symbol (not color-only).
 */
export function AdminBadge() {
  return (
    <span
      role="status"
      aria-label="Administrator"
      title="Administrator"
      className="inline-flex items-center gap-0.5 rounded border border-teal-800/40 bg-teal-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-950"
    >
      <span aria-hidden="true" className="leading-none">
        ★
      </span>
      Admin
    </span>
  );
}
