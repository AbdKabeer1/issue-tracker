"use client";

import { useState } from "react";
import { copyText } from "@/lib/clipboard";
import { useToast } from "@/components/ui/toast";

export function CopyProjectIdButton({ projectId }: { projectId: string }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const ok = await copyText(projectId);
    if (ok) {
      toast("Project ID copied to clipboard.");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast(`Couldn't copy automatically. Project ID: ${projectId}`, "error");
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label="Copy Project ID"
      title="Copy Project ID for API and agent configuration"
      className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-600 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
    >
      {copied ? (
        <>
          <svg
            className="h-3.5 w-3.5 text-teal-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2.5"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-[11px] font-semibold text-teal-700">Copied</span>
        </>
      ) : (
        <>
          <svg
            className="h-3.5 w-3.5 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          <span className="text-[11px]">Copy ID</span>
        </>
      )}
    </button>
  );
}
