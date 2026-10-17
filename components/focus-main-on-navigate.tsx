"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { MAIN_CONTENT_ID } from "@/components/skip-link";

/**
 * Client-side navigation swaps the page without moving focus, so focus stayed
 * on the link that had just disappeared: a screen reader stayed silent about
 * where it now was, and the next Tab carried on from the old position.
 *
 * On every path change this moves focus into the main landmark, the way a full
 * page load does. Announcing the new page is left to Next.js's own route
 * announcer, which already reads the document title.
 */
export function FocusMainOnNavigate() {
  const pathname = usePathname();
  const firstRender = useRef(true);

  useEffect(() => {
    // The initial load already starts at the top of the document.
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    // After paint, so focus lands on the new page rather than the old one.
    const frame = requestAnimationFrame(() => {
      document.getElementById(MAIN_CONTENT_ID)?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  return null;
}
