"use client";

import { useEffect, useId, useRef, useState, type SyntheticEvent } from "react";
import { describeOverflowVoters, type OverflowVoters } from "@/lib/voters";

type VoterOverflowBadgeProps = {
  /** The "+N" text drawn on the badge. */
  label: string;
  overflow: OverflowVoters;
  size: "sm" | "md";
};

/**
 * The "+N" after the voter faces, naming who it stands for (#408).
 *
 * The list opens on hover, on keyboard focus, and on tap (touch screens have
 * no hover). On the issue list the badge sits inside the row's link, so a
 * click opens the list instead of following the link.
 *
 * The badge's label carries every name, so the popover itself is hidden from
 * assistive tech rather than read out twice.
 */
export function VoterOverflowBadge({ label, overflow, size }: VoterOverflowBadgeProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const popoverId = useId();
  const description = describeOverflowVoters(overflow);
  const isSm = size === "sm";

  // A tap elsewhere closes a list opened by tapping the badge.
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const toggle = (event: SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setOpen((value) => !value);
  };

  return (
    // The inner badge is the control (role="button" with Enter/Space/Escape
    // handling). This wrapper only stops clicks reaching the row's link.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <span
      ref={rootRef}
      className="group/overflow relative inline-flex"
      onMouseLeave={() => setOpen(false)}
      // Clicks anywhere in here (the badge or the list) must not follow the
      // row's link on the issue list.
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <span
        role="button"
        tabIndex={0}
        aria-label={description}
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={toggle}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") toggle(event);
          if (event.key === "Escape") {
            setOpen(false);
            event.currentTarget.blur();
          }
        }}
        className={`relative inline-flex cursor-default items-center justify-center rounded-full bg-zk-chip font-bold text-zk-text2 ring-card tabular-nums select-none outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
          isSm ? "h-5 w-5 text-[9px] ring-1" : "h-7 w-7 text-xs ring-2"
        }`}
      >
        {label}
      </span>
      <span
        id={popoverId}
        aria-hidden="true"
        className={`absolute top-full left-0 z-20 mt-1.5 max-h-60 w-max max-w-56 overflow-y-auto rounded-lg border border-zk-border bg-zk-surface px-3 py-2 text-left text-xs font-normal text-zk-text2 shadow-lg transition-opacity group-hover/overflow:visible group-hover/overflow:opacity-100 group-focus-within/overflow:visible group-focus-within/overflow:opacity-100 ${
          open ? "visible opacity-100" : "invisible opacity-0"
        }`}
      >
        <ul className="space-y-0.5">
          {overflow.names.map((name, index) => (
            <li key={`${index}-${name}`} className="break-words">
              {name}
            </li>
          ))}
        </ul>
        {overflow.others > 0 ? (
          <p className={`text-zk-muted ${overflow.names.length > 0 ? "mt-1" : ""}`}>
            {overflow.names.length > 0 ? "and " : ""}
            {overflow.others} {overflow.others === 1 ? "other" : "others"}
          </p>
        ) : null}
      </span>
    </span>
  );
}
