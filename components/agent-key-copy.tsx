"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { copyText } from "@/lib/clipboard";
import { useToast } from "@/components/ui/toast";

/** A live key's prefix. The secret itself is never stored, so this is all the header can show. */
export type AgentKeyHint = {
  prefix: string;
  projectName: string | null;
};

export type AgentKeyCopyButtonProps = {
  projectId?: string | null;
  projectName?: string | null;
  fullWidth?: boolean;
  /** Prefixes of live keys for the active project, including legacy tenant-wide keys. */
  keys?: AgentKeyHint[];
};

export function AgentKeyCopyButton({
  projectId,
  projectName,
  fullWidth = false,
  keys = [],
}: AgentKeyCopyButtonProps) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click or Escape
  useEffect(() => {
    if (!popoverOpen) return;
    const onPointer = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setPopoverOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPopoverOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [popoverOpen]);

  if (!projectId) return null;

  async function handleCopyKey(e?: React.MouseEvent) {
    e?.stopPropagation();
    const ok = await copyText(projectId!);
    if (ok) {
      toast("Agent project key copied to clipboard.");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast(`Could not copy. Key: ${projectId}`, "error");
    }
  }

  async function handleCopyEndpoint(e?: React.MouseEvent) {
    e?.stopPropagation();
    const origin = typeof window !== "undefined" ? window.location.origin : "https://ziki.dev";
    const endpoint = `${origin}/api/v1/issues?projectId=${projectId}`;
    const ok = await copyText(endpoint);
    if (ok) {
      toast("Agent API endpoint URL copied.");
    }
  }

  const shortKey = projectId.length > 8 ? `${projectId.slice(0, 6)}…` : projectId;

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center ${fullWidth ? "w-full" : "shrink-0"}`}
    >
      <div
        className={`inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white shadow-2xs transition hover:border-slate-300 ${
          fullWidth ? "w-full justify-between" : ""
        }`}
      >
        {/* Toggle popover with details */}
        <button
          type="button"
          onClick={() => setPopoverOpen((prev) => !prev)}
          title="View Agent Key configuration details"
          aria-expanded={popoverOpen}
          className="inline-flex h-full items-center gap-1.5 px-2.5 text-xs text-slate-700 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 rounded-l-lg"
        >
          <span className="text-sm" aria-hidden="true">🔑</span>
          <span className="font-semibold text-teal-800 text-[11px] tracking-wide uppercase">
            Agent Key:
          </span>
          <span className="font-mono text-[11px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
            {shortKey}
          </span>
        </button>

        {/* 1-Click Copy Button */}
        <button
          type="button"
          onClick={handleCopyKey}
          title={`Copy key to clipboard: ${projectId}`}
          aria-label="Copy key to agent"
          className="inline-flex h-full items-center border-l border-slate-200 px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 rounded-r-lg transition"
        >
          {copied ? (
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 text-[11px]">
              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Copied
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px]">
              <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy
            </span>
          )}
        </button>
      </div>

      {/* Details Popover */}
      {popoverOpen ? (
        <div
          role="dialog"
          aria-label="Agent Key Information"
          className="absolute left-0 top-full z-50 mt-1.5 w-80 rounded-xl border border-slate-200 bg-white p-4 text-xs shadow-lg ring-1 ring-black/5"
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="font-semibold text-slate-900 flex items-center gap-1.5">
              <span>🔑</span> Agent Project Configuration
            </span>
            <button
              type="button"
              onClick={() => setPopoverOpen(false)}
              className="text-slate-400 hover:text-slate-600 text-xs px-1"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="mt-3 space-y-3">
            <div>
              <span className="text-slate-500 block text-[11px]">Active Project</span>
              <span className="font-medium text-slate-800">{projectName ?? "Current Project"}</span>
            </div>

            <div>
              <span className="text-slate-500 block text-[11px]">API key prefixes</span>
              {keys.length > 0 ? (
                <ul className="mt-1 space-y-1">
                  {keys.map((key) => (
                    <li key={`${key.prefix}-${key.projectName ?? "all"}`} className="font-mono text-[11px] text-slate-800">
                      {key.prefix}…{key.projectName ? ` · ${key.projectName}` : " · every project"}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-slate-600">
                  No live key for this project. Register or regenerate one in settings. The full secret is shown only once.
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-slate-500 text-[11px]">Project id (for API queries)</span>
                <button
                  type="button"
                  onClick={handleCopyKey}
                  className="text-teal-700 hover:text-teal-900 font-medium hover:underline text-[11px]"
                >
                  Copy Key
                </button>
              </div>
              <code className="block rounded bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-800 select-all border border-slate-200 break-all">
                {projectId}
              </code>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-slate-500 text-[11px]">Issue Feed Endpoint</span>
                <button
                  type="button"
                  onClick={handleCopyEndpoint}
                  className="text-teal-700 hover:text-teal-900 font-medium hover:underline text-[11px]"
                >
                  Copy URL
                </button>
              </div>
              <code className="block rounded bg-slate-50 px-2 py-1 font-mono text-[10px] text-slate-700 border border-slate-200 break-all">
                /api/v1/issues?projectId={projectId}
              </code>
            </div>

            <div className="pt-2 border-t border-slate-100 flex flex-col gap-1.5 font-medium text-teal-700">
              <Link
                href="/settings/agents"
                onClick={() => setPopoverOpen(false)}
                className="hover:underline hover:text-teal-900 flex items-center justify-between"
              >
                <span>Manage Agent API Keys</span>
                <span>→</span>
              </Link>
              <Link
                href="/settings/agents/pair"
                onClick={() => setPopoverOpen(false)}
                className="hover:underline hover:text-teal-900 flex items-center justify-between"
              >
                <span>Pair an Agent via Code</span>
                <span>→</span>
              </Link>
              <Link
                href="/llms.txt"
                onClick={() => setPopoverOpen(false)}
                className="hover:underline hover:text-teal-900 flex items-center justify-between"
              >
                <span>Agent Spec (/llms.txt)</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
