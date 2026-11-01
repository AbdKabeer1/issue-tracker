"use client";

import { useState, useEffect, useCallback } from "react";

export type AgentPlanReviewProps = {
  issueNumber?: number;
  issueTitle?: string;
  agentName?: string;
  personName?: string;
  branchName?: string;
  filesChanged?: number;
  additions?: number;
  deletions?: number;
  estimatedDuration?: string;
  onAuthorize?: (directive: string) => void;
  onRequestRevision?: () => void;
};

export function AgentPlanReview({
  issueNumber = 1042,
  issueTitle = "Race condition in event cursor during concurrent polling",
  agentName = "agent-sentinel",
  personName = "henryuks",
  branchName = "fix/1042-event-cursor",
  filesChanged = 2,
  additions = 50,
  deletions = 4,
  estimatedDuration = "20m",
  onAuthorize,
  onRequestRevision,
}: AgentPlanReviewProps) {
  const [testFileOpen, setTestFileOpen] = useState(false);
  const [directive, setDirective] = useState("");
  const [status, setStatus] = useState<"idle" | "dispatched" | "revision_requested">("idle");
  const [requireVitest, setRequireVitest] = useState(true);
  const [requirePeerReview, setRequirePeerReview] = useState(true);

  const handleApprove = useCallback(() => {
    setStatus("dispatched");
    onAuthorize?.(directive);
  }, [directive, onAuthorize]);

  const handleReject = useCallback(() => {
    setStatus("revision_requested");
    onRequestRevision?.();
  }, [onRequestRevision]);

  const handleReset = useCallback(() => {
    setStatus("idle");
    setDirective("");
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        if (status === "idle") {
          handleApprove();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [status, handleApprove]);

  return (
    <section 
      aria-label="Agent Resolution Proposal" 
      className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1324] text-slate-900 dark:text-slate-100 shadow-sm overflow-hidden text-sm"
    >
      {/* Issue Header Context */}
      <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#070d19] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400">
            #{issueNumber}
          </span>
          <span className="text-xs font-medium truncate max-w-md">
            {issueTitle}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            review pending
          </span>
        </div>
      </div>

      {/* Agent Proposal Header */}
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900 dark:text-slate-100">{agentName}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">for</span>
              <span className="font-medium text-xs text-slate-800 dark:text-slate-200">@{personName}</span>
              <span className="text-slate-400">·</span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">branch: {branchName}</span>
            </div>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Polling workers currently execute the cursor read outside the row-level lock. Moving the cursor read inside the <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-[11px] text-slate-900 dark:text-slate-100">SELECT ... FOR UPDATE SKIP LOCKED</code> transaction serializes concurrent batches without worker starvation.
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
              {filesChanged} files · +{additions} / -{deletions}
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-1">Est. {estimatedDuration} execution</div>
          </div>
        </div>
      </div>

      {/* Git Diff View */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        {/* File 1 Bar */}
        <div className="px-5 py-2 bg-slate-50 dark:bg-[#070d19] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            <span className="font-mono font-medium text-slate-900 dark:text-slate-100">lib/agent-api/events.ts</span>
          </div>
          <div className="flex items-center gap-3 font-mono text-[11px]">
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">+18</span>
            <span className="text-rose-600 dark:text-rose-400 font-semibold">-4</span>
          </div>
        </div>

        {/* File 1 Diff Lines */}
        <div className="overflow-x-auto font-mono text-[11px] leading-5 divide-y divide-slate-100 dark:divide-slate-900">
          <div className="flex py-1 px-3 bg-slate-50 dark:bg-[#070d19] text-slate-400 select-none">
            <span className="w-10 text-right pr-4">142</span>
            <span className="w-10 text-right pr-4">142</span>
            <span className="pl-2">@@ -142,6 +142,10 @@ export async function pollEvents(tenantId: string) &#123;</span>
          </div>
          <div className="flex py-0.5 px-3 text-slate-600 dark:text-slate-400">
            <span className="w-10 text-right pr-4 text-slate-400 select-none">143</span>
            <span className="w-10 text-right pr-4 text-slate-400 select-none">143</span>
            <span className="pl-2">&nbsp;&nbsp;return await prisma.$transaction(async (tx) =&gt; &#123;</span>
          </div>
          <div className="flex py-0.5 px-3 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300">
            <span className="w-10 text-right pr-4 select-none opacity-60">144</span>
            <span className="w-10 text-right pr-4 select-none opacity-0"></span>
            <span className="pl-2">-&nbsp;&nbsp;&nbsp;&nbsp;const cursor = await getCursor(tenantId);</span>
          </div>
          <div className="flex py-0.5 px-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300">
            <span className="w-10 text-right pr-4 select-none opacity-0"></span>
            <span className="w-10 text-right pr-4 select-none opacity-60">144</span>
            <span className="pl-2">+&nbsp;&nbsp;&nbsp;&nbsp;// Acquire exclusive cursor lock inside transaction to eliminate race window</span>
          </div>
          <div className="flex py-0.5 px-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300">
            <span className="w-10 text-right pr-4 select-none opacity-0"></span>
            <span className="w-10 text-right pr-4 select-none opacity-60">145</span>
            <span className="pl-2">+&nbsp;&nbsp;&nbsp;&nbsp;const [cursor] = await tx.$queryRaw&lt;CursorRow[]&gt;`</span>
          </div>
          <div className="flex py-0.5 px-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300">
            <span className="w-10 text-right pr-4 select-none opacity-0"></span>
            <span className="w-10 text-right pr-4 select-none opacity-60">146</span>
            <span className="pl-2">+&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;SELECT * FROM &quot;EventCursor&quot; WHERE &quot;tenantId&quot; = $&#123;tenantId&#125; FOR UPDATE SKIP LOCKED</span>
          </div>
          <div className="flex py-0.5 px-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300">
            <span className="w-10 text-right pr-4 select-none opacity-0"></span>
            <span className="w-10 text-right pr-4 select-none opacity-60">147</span>
            <span className="pl-2">+&nbsp;&nbsp;&nbsp;&nbsp;`;</span>
          </div>
          <div className="flex py-0.5 px-3 text-slate-600 dark:text-slate-400">
            <span className="w-10 text-right pr-4 text-slate-400 select-none">145</span>
            <span className="w-10 text-right pr-4 text-slate-400 select-none">148</span>
            <span className="pl-2">&nbsp;&nbsp;&nbsp;&nbsp;const events = await fetchBatch(tx, cursor);</span>
          </div>
        </div>

        {/* File 2 Header & Accordion */}
        <div 
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTestFileOpen(!testFileOpen); } }}
          onClick={() => setTestFileOpen(!testFileOpen)}
          className="px-5 py-2.5 bg-slate-50 dark:bg-[#070d19] border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition select-none"
        >
          <div className="flex items-center gap-2">
            <svg 
              className={`w-3.5 h-3.5 transition-transform duration-150 ${testFileOpen ? "rotate-90" : ""}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
            </svg>
            <span className="font-mono font-medium text-slate-900 dark:text-slate-100">
              lib/agent-api/events.atomicity.test.ts
            </span>
            <span className="text-[11px] text-slate-400">
              ({testFileOpen ? "click to hide test cases" : "click to view 3 concurrency test cases"})
            </span>
          </div>
          <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">+32</span>
        </div>

        {testFileOpen && (
          <div className="overflow-x-auto font-mono text-[11px] leading-5 divide-y divide-slate-100 dark:divide-slate-900 border-t border-slate-100 dark:border-slate-900">
            <div className="flex py-1 px-3 bg-slate-50 dark:bg-[#070d19] text-slate-400 select-none">
              <span className="w-10 text-right pr-4">0</span>
              <span className="w-10 text-right pr-4">1</span>
              <span className="pl-2">@@ -0,0 +1,14 @@ describe(&quot;events.atomicity&quot;, () =&gt; &#123;</span>
            </div>
            <div className="flex py-0.5 px-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300">
              <span className="w-10 text-right pr-4 select-none opacity-0"></span>
              <span className="w-10 text-right pr-4 select-none opacity-60">2</span>
              <span className="pl-2">+&nbsp;&nbsp;it(&quot;serializes concurrent pollers without dropping event cursor&quot;, async () =&gt; &#123;</span>
            </div>
            <div className="flex py-0.5 px-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300">
              <span className="w-10 text-right pr-4 select-none opacity-0"></span>
              <span className="w-10 text-right pr-4 select-none opacity-60">3</span>
              <span className="pl-2">+&nbsp;&nbsp;&nbsp;&nbsp;const [worker1, worker2] = await Promise.all([</span>
            </div>
            <div className="flex py-0.5 px-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300">
              <span className="w-10 text-right pr-4 select-none opacity-0"></span>
              <span className="w-10 text-right pr-4 select-none opacity-60">4</span>
              <span className="pl-2">+&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;pollEvents(&quot;tenant-test&quot;),</span>
            </div>
            <div className="flex py-0.5 px-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300">
              <span className="w-10 text-right pr-4 select-none opacity-0"></span>
              <span className="w-10 text-right pr-4 select-none opacity-60">5</span>
              <span className="pl-2">+&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;pollEvents(&quot;tenant-test&quot;),</span>
            </div>
            <div className="flex py-0.5 px-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300">
              <span className="w-10 text-right pr-4 select-none opacity-0"></span>
              <span className="w-10 text-right pr-4 select-none opacity-60">6</span>
              <span className="pl-2">+&nbsp;&nbsp;&nbsp;&nbsp;]);</span>
            </div>
            <div className="flex py-0.5 px-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300">
              <span className="w-10 text-right pr-4 select-none opacity-0"></span>
              <span className="w-10 text-right pr-4 select-none opacity-60">7</span>
              <span className="pl-2">+&nbsp;&nbsp;&nbsp;&nbsp;expect(worker1.cursor).not.toEqual(worker2.cursor);</span>
            </div>
            <div className="flex py-0.5 px-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300">
              <span className="w-10 text-right pr-4 select-none opacity-0"></span>
              <span className="w-10 text-right pr-4 select-none opacity-60">8</span>
              <span className="pl-2">+&nbsp;&nbsp;&#125;);</span>
            </div>
          </div>
        )}
      </div>

      {/* Execution Controls & Steering Directives */}
      <div className="p-5 space-y-4">
        <div>
          <p className="block text-xs font-semibold text-slate-900 dark:text-slate-100 mb-2">Execution guards</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <label className="flex items-center gap-2.5 p-2 rounded border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={requireVitest} 
                onChange={(e) => setRequireVitest(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-0" 
              />
              <span className="text-slate-800 dark:text-slate-200">Require clean Vitest run before PR</span>
            </label>
            <label className="flex items-center gap-2.5 p-2 rounded border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={requirePeerReview} 
                onChange={(e) => setRequirePeerReview(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-0" 
              />
              <span className="text-slate-800 dark:text-slate-200">Independent reviewer check</span>
            </label>
          </div>
        </div>

        {/* Steering Directive Input */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="agent-steering-input" className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              Steering directive
            </label>
            <span className="text-[11px] text-slate-400">Optional constraint passed to agent runner</span>
          </div>
          <input 
            id="agent-steering-input"
            type="text" 
            value={directive}
            onChange={(e) => setDirective(e.target.value)}
            disabled={status !== "idle"}
            placeholder="e.g. Ensure compatibility with Postgres 15 connection pooler" 
            className="w-full px-3 py-2 text-xs rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1324] text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 transition disabled:opacity-60"
          />
        </div>

        {/* Status Confirmation Banners */}
        {status === "dispatched" && (
          <div className="p-3 rounded border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-300 text-xs font-mono">
            <div className="flex items-center justify-between mb-1.5">
              <strong>✓ Dispatched to {agentName}</strong>
              <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-semibold">
                PR ready
              </span>
            </div>
            <div className="space-y-0.5 text-[11px] text-slate-600 dark:text-slate-400">
              <div>• Branch locked: <code>{branchName}</code></div>
              <div>• Execution constraints: {requireVitest ? "Vitest gate active" : "Vitest bypassed"} · {requirePeerReview ? "Peer review required" : "Single verdict"}</div>
            </div>
            {directive && (
              <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">
                Directive injected: <code>&quot;{directive}&quot;</code>
              </div>
            )}
          </div>
        )}

        {status === "revision_requested" && (
          <div className="p-3 rounded border border-amber-500/30 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-300 text-xs font-mono">
            <div className="font-semibold">Revision requested</div>
            <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
              Agent released lock on #{issueNumber}. Awaiting updated proposal.
            </div>
          </div>
        )}

        {/* Action Bar */}
        <div className="pt-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {status === "idle" ? (
              <button 
                type="button"
                onClick={handleReject} 
                className="px-3.5 py-1.5 text-xs font-medium rounded border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition cursor-pointer"
              >
                Request Revision
              </button>
            ) : (
              <button 
                type="button"
                onClick={handleReset} 
                className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline cursor-pointer"
              >
                Reset test state
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 hidden sm:inline font-mono">⌘ + ↵</span>
            <button 
              type="button"
              disabled={status !== "idle"}
              onClick={handleApprove} 
              className="px-4 py-1.5 text-xs font-semibold rounded bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
            >
              <span>{status === "dispatched" ? "Dispatched" : "Authorize & Dispatch"}</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
