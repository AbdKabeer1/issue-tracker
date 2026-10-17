/**
 * The one decision a focus trap has to get right, kept pure so it can be
 * tested without a browser: given where focus is and which way Tab went,
 * where should it land?
 */

/** Selector for the controls a keyboard user can reach with Tab. */
export const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The index Tab should move to, or null when the browser's own behaviour is
 * already correct and the event should be left alone.
 *
 * Only the two edges are intercepted: Tab on the last control wraps to the
 * first, Shift+Tab on the first wraps to the last. Anywhere in between, the
 * browser already moves to the right neighbour. Focus that has somehow
 * escaped the trap (index -1) is pulled back to the start or the end.
 */
export function wrapFocusIndex(
  current: number,
  count: number,
  backwards: boolean,
): number | null {
  if (count === 0) return null;
  if (current === -1) return backwards ? count - 1 : 0;
  if (backwards && current === 0) return count - 1;
  if (!backwards && current === count - 1) return 0;
  return null;
}
