"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { COMMENT_PARAM } from "@/lib/comment-window";

/**
 * A `#comment-<id>` link whose comment is older than the loaded window
 * (#280) has nothing to scroll to: the fragment never reaches the server.
 * This turns it into `?comment=<id>#comment-<id>`, which the server uses to
 * load down to that thread. Links made by the app already carry the query;
 * this catches links copied from the address bar or written by hand.
 */
export function CommentPermalinkResolver() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const resolve = () => {
      const match = /^#comment-([A-Za-z0-9_-]{1,64})$/.exec(window.location.hash);
      if (!match) return;
      const id = match[1];
      if (document.getElementById(`comment-${id}`)) return;
      // Already asked the server; the comment really isn't on this issue.
      if (searchParams.get(COMMENT_PARAM) === id) return;
      const params = new URLSearchParams(searchParams);
      params.set(COMMENT_PARAM, id);
      router.replace(`${pathname}?${params.toString()}#comment-${id}`, { scroll: false });
    };
    resolve();
    window.addEventListener("hashchange", resolve);
    return () => window.removeEventListener("hashchange", resolve);
  }, [pathname, router, searchParams]);

  // After the server re-renders with the thread included, scroll to it.
  useEffect(() => {
    const id = searchParams.get(COMMENT_PARAM);
    if (!id) return;
    document.getElementById(`comment-${id}`)?.scrollIntoView({ block: "start" });
  }, [searchParams]);

  return null;
}
