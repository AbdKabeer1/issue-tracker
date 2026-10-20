"use client";

import { useState, useId, useEffect, useRef } from "react";

type ExpandableTextProps = {
  /** The full text content to display */
  children: React.ReactNode;
  /** Maximum number of lines to show when collapsed */
  maxLines?: number;
  /** Text for the expand button */
  expandText?: string;
  /** Text for the collapse button */
  collapseText?: string;
  /** Additional CSS classes */
  className?: string;
};

export function ExpandableText({
  children,
  maxLines = 3,
  expandText = "View more",
  collapseText = "View less",
  className,
}: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const detailsId = useId();

  // Check if content overflows the max lines
  useEffect(() => {
    const element = contentRef.current;
    if (!element) return;

    const style = window.getComputedStyle(element);
    const lineHeight = parseFloat(style.lineHeight);
    const maxHeight = lineHeight * maxLines;
    setIsTruncated(element.scrollHeight > maxHeight);
  }, [maxLines]);

  if (!isTruncated) {
    return (
      <div ref={contentRef} className={className}>
        {children}
      </div>
    );
  }

  return (
    <div className={className}>
      <div
        ref={contentRef}
        id={detailsId}
        className={expanded ? "" : "line-clamp-3"}
        style={{ WebkitLineClamp: expanded ? "unset" : maxLines }}
      >
        {children}
      </div>
      <button
        type="button"
        className="mt-2 text-xs font-medium text-teal-700 hover:underline"
        aria-expanded={expanded}
        aria-controls={detailsId}
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? collapseText : expandText}
      </button>
    </div>
  );
}