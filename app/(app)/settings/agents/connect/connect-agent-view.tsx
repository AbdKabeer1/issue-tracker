"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { copyText } from "@/lib/clipboard";
import type { AgentTemplates } from "@/lib/agents/templates";
import {
  checkAgentConnectionAction,
  type ConnectionStatusResult,
} from "./actions";
import {
  agentsLink,
  agentsMutedClass,
  agentsPrimaryBtn,
  agentsSecondaryBtn,
  agentsSurface,
} from "../agents-ui";

type TabId = "claude" | "chatgpt" | "script" | "mcp";
type ScriptLang = "node" | "python";

const ASSISTANTS: { id: TabId; label: string; hint: string; icon: ReactNode }[] = [
  {
    id: "claude",
    label: "Claude Code / Desktop",
    hint: "Paste a prompt into Claude",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path strokeLinecap="round" d="M12 3v18M5 8h14M5 16h14" />
      </svg>
    ),
  },
  {
    id: "chatgpt",
    label: "ChatGPT / Other Assistants",
    hint: "Any assistant with web access",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path strokeLinecap="round" d="M8 12h8M12 8v8" />
      </svg>
    ),
  },
  {
    id: "script",
    label: "Script (Node & Python)",
    hint: "Run a local poller",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="m8 6-6 6 6 6M16 6l6 6-6 6" />
      </svg>
    ),
  },
  {
    id: "mcp",
    label: "Claude Desktop (MCP)",
    hint: "Tools in Claude Desktop",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
];

export function ConnectAgentView({
  templates,
  siteUrl,
  projectId,
  projectName,
  initialConnected = false,
  initialAgentName = null,
}: {
  templates: AgentTemplates;
  siteUrl: string;
  projectId: string | null;
  projectName: string | null;
  initialConnected?: boolean;
  initialAgentName?: string | null;
}) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<TabId>("claude");
  const [scriptLang, setScriptLang] = useState<ScriptLang>("node");
  const [copied, setCopied] = useState(false);
  const [pageOpenedAt] = useState(() => new Date().toISOString());
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatusResult>(() =>
    initialConnected
      ? { connected: true, agent: initialAgentName ? { id: "", name: initialAgentName } : undefined }
      : { connected: false },
  );
  const [isPending, startTransition] = useTransition();

  const currentSnippet =
    activeTab === "claude"
      ? templates.claude
      : activeTab === "chatgpt"
        ? templates.chatgpt
        : activeTab === "mcp"
          ? templates.mcp
          : scriptLang === "node"
            ? templates.node
            : templates.python;

  const currentFilename =
    activeTab === "claude" || activeTab === "chatgpt"
      ? "prompt"
      : activeTab === "mcp"
        ? "claude_desktop_config.json"
        : scriptLang === "node"
          ? "agent.mjs"
          : "agent.py";

  const progress = connectionStatus.connected ? 4 : copied ? 3 : 1;
  const stepper = ["Choose assistant", "Copy setup", "Approve pairing", "Test connection"].map((label, i) => {
    const n = i + 1;
    const done = n < progress || (n === 4 && connectionStatus.connected);
    const active = !done && n === progress;
    return { n, label, done, active };
  });

  async function handleCopy() {
    const ok = await copyText(currentSnippet);
    if (!ok) {
      toast("Could not copy automatically. Please select and copy the text.", "error");
      return;
    }
    setCopied(true);
    toast("Snippet copied to clipboard!", "success");
    setTimeout(() => setCopied(false), 2000);
  }

  function handleTestConnection() {
    startTransition(async () => {
      const result = await checkAgentConnectionAction({ projectId, since: pageOpenedAt });
      setConnectionStatus(result);
      if (result.connected) {
        toast(`Connection verified! Agent "${result.agent?.name ?? "Agent"}" called /agents/me.`, "success");
      } else {
        toast(result.message ?? "No agent call detected yet.", "info");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className={`flex flex-col gap-3 ${agentsSurface} p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5`}>
        <div>
          <span className="text-xs font-bold uppercase tracking-[0.06em] text-zk-muted">Active project</span>
          <p className="text-sm font-semibold text-zk-text">
            {projectName ? `${projectName}` : "Default project"}{" "}
            {projectId ? <span className="font-mono text-xs font-normal text-zk-muted">({projectId})</span> : null}
          </p>
        </div>
        <div className="text-xs text-zk-muted">
          Target origin <span className="font-mono font-semibold text-zk-text2">{siteUrl}</span>
        </div>
      </div>

      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {stepper.map((step) => (
          <li
            key={step.n}
            className={`flex items-center gap-3 rounded-2xl border px-3.5 py-3 ${
              step.active ? "border-electric-blue-strong bg-zk-tint" : "border-zk-border bg-zk-surface"
            }`}
          >
            <span
              className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold ${
                step.done
                  ? "bg-zk-ok-bg text-zk-ok-fg"
                  : step.active
                    ? "bg-electric-blue-strong text-white"
                    : "bg-zk-chip text-zk-muted"
              }`}
            >
              {step.done ? "✓" : step.n}
            </span>
            <span className="text-sm font-semibold text-zk-text">
              <span className="sr-only">Step {step.n}. </span>
              {step.label}
            </span>
          </li>
        ))}
      </ol>

      <section className={`${agentsSurface} overflow-hidden`} aria-labelledby="choose-assistant-heading">
        <div className="space-y-4 p-4 sm:p-6">
          <h2 id="choose-assistant-heading" className="text-base font-extrabold text-zk-text">
            1. Choose your assistant
          </h2>
          <div role="tablist" aria-label="Agent connection methods" className="grid gap-3 sm:grid-cols-2">
            {ASSISTANTS.map((assistant) => {
              const on = activeTab === assistant.id;
              return (
                <button
                  key={assistant.id}
                  role="tab"
                  id={`tab-${assistant.id}`}
                  aria-controls={`panel-${assistant.id}`}
                  aria-selected={on}
                  type="button"
                  onClick={() => {
                    setActiveTab(assistant.id);
                    setCopied(false);
                  }}
                  className={`flex flex-col gap-2 rounded-2xl p-3.5 text-left transition ${
                    on
                      ? "border-2 border-electric-blue-strong bg-zk-tint"
                      : "m-px border border-zk-border bg-zk-surface hover:border-electric-blue/40"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                      on ? "bg-electric-blue-strong text-white" : "bg-zk-tint text-zk-accent"
                    }`}
                  >
                    {assistant.icon}
                  </span>
                  <span className="text-sm font-bold text-zk-text">{assistant.label}</span>
                  <span className="text-xs text-zk-muted">{assistant.hint}</span>
                </button>
              );
            })}
          </div>

          <div className="space-y-3 border-t border-zk-divider pt-4">
            <h3 className="text-base font-extrabold text-zk-text">2. Copy the setup block</h3>

            {activeTab === "claude" && (
              <div id="panel-claude" role="tabpanel" aria-labelledby="tab-claude" className="space-y-3">
                <ol className={`list-decimal space-y-1 pl-5 ${agentsMutedClass}`}>
                  <li>Copy the prompt block below.</li>
                  <li>Paste it into your Claude Code session or Claude Desktop prompt.</li>
                  <li>Claude will ask for an agent name, request a pairing code, and show you an approval link.</li>
                  <li>Open the approval link in your browser to approve the pairing.</li>
                  <li>
                    Once Claude calls <code className="font-mono text-xs text-zk-text">/agents/me</code>, click{" "}
                    <strong>Test connection</strong> below!
                  </li>
                </ol>
              </div>
            )}

            {activeTab === "chatgpt" && (
              <div id="panel-chatgpt" role="tabpanel" aria-labelledby="tab-chatgpt" className="space-y-3">
                <ol className={`list-decimal space-y-1 pl-5 ${agentsMutedClass}`}>
                  <li>Copy the prompt block below.</li>
                  <li>Paste it into ChatGPT or your assistant with web/curl access.</li>
                  <li>Follow the assistant&apos;s prompt to approve the pairing code.</li>
                  <li>
                    Click <strong>Test connection</strong> below once your assistant has verified.
                  </li>
                </ol>
              </div>
            )}

            {activeTab === "script" && (
              <div id="panel-script" role="tabpanel" aria-labelledby="tab-script" className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className={agentsMutedClass}>
                    Pick your language, save the file locally, and run it. The script pairs automatically, saves the
                    key locally, and long-polls <code className="font-mono text-xs text-zk-text">/api/v1/events</code>.
                  </p>
                  <div className="inline-flex rounded-full bg-zk-seg p-1 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setScriptLang("node")}
                      className={`rounded-full px-3 py-1.5 transition ${
                        scriptLang === "node" ? "bg-zk-surface text-zk-text shadow-sm" : "text-zk-text2 hover:text-zk-text"
                      }`}
                    >
                      Node.js
                    </button>
                    <button
                      type="button"
                      onClick={() => setScriptLang("python")}
                      className={`rounded-full px-3 py-1.5 transition ${
                        scriptLang === "python"
                          ? "bg-zk-surface text-zk-text shadow-sm"
                          : "text-zk-text2 hover:text-zk-text"
                      }`}
                    >
                      Python 3
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "mcp" && (
              <div id="panel-mcp" role="tabpanel" aria-labelledby="tab-mcp" className="space-y-3">
                <ol className={`list-decimal space-y-1 pl-5 ${agentsMutedClass}`}>
                  <li>
                    In a clone of this repo, pair once:{" "}
                    <code className="font-mono text-xs text-zk-text">node scripts/ziki-agent.mjs pair --url {siteUrl}</code>
                  </li>
                  <li>
                    Build the server:{" "}
                    <code className="font-mono text-xs text-zk-text">
                      cd packages/mcp-server &amp;&amp; pnpm install &amp;&amp; pnpm build
                    </code>
                  </li>
                  <li>
                    Paste the config below into{" "}
                    <code className="font-mono text-xs text-zk-text">claude_desktop_config.json</code>, replacing the
                    path with where you cloned the repo.
                  </li>
                  <li>Restart Claude Desktop. Ziki&apos;s tools appear in the tools menu.</li>
                </ol>
                <p className="text-xs text-zk-muted">
                  The config holds no key. The server reads the one saved by <code className="font-mono">pair</code>.
                </p>
              </div>
            )}

            <div className="relative">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-[0.06em] text-zk-muted">{currentFilename}</span>
                <Button
                  type="button"
                  onClick={handleCopy}
                  className={`h-[34px] rounded-full px-3.5 text-xs font-bold ${
                    copied
                      ? "bg-zk-ok-fg text-white hover:bg-zk-ok-fg"
                      : "bg-electric-blue-strong text-white hover:bg-[#2552af]"
                  }`}
                >
                  {copied ? "Copied" : `Copy ${currentFilename}`}
                </Button>
              </div>
              <pre className="max-h-96 overflow-auto rounded-2xl border border-zk-border bg-zk-chip p-4 font-mono text-xs leading-relaxed text-zk-text [scrollbar-width:thin]">
                {currentSnippet}
              </pre>
            </div>
          </div>
        </div>
      </section>

      <section
        className={`${agentsSurface} p-4 sm:p-6 transition-colors ${connectionStatus.connected ? "border-zk-ok-fg/40" : ""}`}
        aria-labelledby="test-connection-heading"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h2 id="test-connection-heading" className="text-base font-extrabold text-zk-text">
              3. Approve, then test
            </h2>
            <p className="text-sm text-zk-text2">
              {connectionStatus.connected ? (
                <span className="font-semibold text-zk-ok-fg">
                  Connected — {connectionStatus.agent?.name ?? "Agent"} reached /agents/me
                </span>
              ) : (
                <>
                  After you approve the pairing link and your agent calls{" "}
                  <code className="font-mono text-xs">/agents/me</code>, check the connection here.
                </>
              )}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link href="/settings/agents/pair" className={agentsSecondaryBtn}>
              Approve code
            </Link>
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isPending}
              data-testid="test-connection-btn"
              className={agentsPrimaryBtn}
            >
              {isPending ? "Checking…" : connectionStatus.connected ? "Test again" : "Test connection"}
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-4 border-t border-zk-divider pt-3 text-xs font-semibold">
          <Link href="/settings/agents" className={agentsLink}>
            Manage registered agents →
          </Link>
          <Link href="/settings/audit" className={agentsLink}>
            View agent audit log →
          </Link>
          <a href="/llms.txt" target="_blank" rel="noopener noreferrer" className={agentsLink}>
            /llms.txt ↗
          </a>
        </div>
      </section>

      <aside className={`${agentsSurface} space-y-2 p-4 sm:p-5`}>
        <h2 className="text-sm font-extrabold text-zk-text">Good to know</h2>
        <ul className={`list-disc space-y-1 pl-5 ${agentsMutedClass}`}>
          <li>Connect one agent per level — observer, contributor, reviewer and so on.</li>
          <li>Pairing codes last 15 minutes and work once.</li>
          <li>The key goes straight to the agent — it never appears on this page.</li>
        </ul>
        <p className="pt-1 text-sm text-zk-text2">
          Need the full API? The handbook covers pairing, keys and every endpoint.{" "}
          <a href="/llms.txt" target="_blank" rel="noopener noreferrer" className={agentsLink}>
            /llms.txt
          </a>
        </p>
      </aside>
    </div>
  );
}
