export const MAIN_CONTENT_ID = "main-content";

/**
 * First focusable element on the page, so a keyboard or screen-reader user can
 * jump past the header instead of tabbing through the whole nav on every page
 * (WCAG 2.4.1). Hidden until focused.
 */
export function SkipLink() {
  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-teal-700 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-white"
    >
      Skip to content
    </a>
  );
}
