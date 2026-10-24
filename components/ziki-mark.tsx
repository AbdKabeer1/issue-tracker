/**
 * The Ziki mark: a lowercase z with an arrow pointing up above its slope (an
 * issue being voted up). Drawn in currentColor so it follows the theme; the
 * arrow takes the lighter brand blue.
 */
export function ZikiMark({ className = "h-7 w-auto", title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 28 32"
      fill="none"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <path
        d="M5 13h16L5 27.5h16"
        stroke="currentColor"
        strokeWidth="4.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M16.5 2.5 21 9h-9Z" fill="#38A3FF" stroke="#38A3FF" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
